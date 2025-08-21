import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPDataLoader, FMPRateLimiter } from '../src/fmp-rate-limiter.js';
import axios from 'axios';

config();

/**
 * Incremental FMP Data Updater
 * Designed to run daily/hourly via cron to update only new data
 * Focuses on: real-time quotes, recent prices, new earnings, economic events
 */

class IncrementalDataUpdater {
  private db: DatabaseClient;
  private loader: FMPDataLoader;
  private rateLimiter: FMPRateLimiter;
  private apiKey: string;
  private symbols: string[] = [];
  private updateWindow: number; // Days to look back for updates
  private stats = {
    totalRequests: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    tablesUpdated: [] as string[],
    startTime: new Date()
  };

  constructor(updateWindow: number = 7) {
    this.db = new DatabaseClient();
    this.loader = new FMPDataLoader(this.db.pool);
    this.rateLimiter = new FMPRateLimiter();
    this.apiKey = process.env.FMP_API_KEY || '';
    this.updateWindow = updateWindow;
    
    const now = new Date();
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FMP Incremental Data Update`);
    console.log(`Time: ${now.toISOString()}`);
    console.log(`Update Window: Last ${updateWindow} days`);
    console.log(`${'='.repeat(70)}\n`);
  }

  /**
   * Get active symbols to update
   */
  async getActiveSymbols(): Promise<void> {
    console.log('[1] Getting active symbols...');
    
    try {
      // Get most actively traded symbols from database
      const result = await this.db.query(`
        SELECT DISTINCT c.symbol, c.market_cap
        FROM fmp.companies c
        INNER JOIN fmp.stock_prices sp ON c.symbol = sp.symbol
        WHERE sp.date > CURRENT_DATE - INTERVAL '30 days'
        AND c.market_cap IS NOT NULL
        ORDER BY c.market_cap DESC NULLS LAST
        LIMIT 100
      `);
      
      if (result.rows.length > 0) {
        this.symbols = result.rows.map(r => r.symbol);
        console.log(`Found ${this.symbols.length} active symbols`);
      } else {
        // Fallback to major symbols
        this.symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 
                       'JPM', 'V', 'JNJ', 'WMT', 'PG', 'UNH', 'DIS', 'MA'];
      }
    } catch (error: any) {
      console.error('Error fetching symbols:', error.message);
      this.symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    }
  }

  /**
   * Update real-time quotes for all symbols
   */
  async updateRealTimeQuotes(): Promise<void> {
    console.log('\n[2] Updating real-time quotes...');
    this.stats.tablesUpdated.push('real_time_quotes');
    
    let successCount = 0;
    const batchSize = 10;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      const batchSymbols = batch.join(',');
      
      try {
        const data = await this.rateLimiter.makeRequest(`/quote/${batchSymbols}`);
        
        if (data && Array.isArray(data)) {
          for (const quote of data) {
            try {
              await this.db.query(`
                INSERT INTO fmp.real_time_quotes (
                  symbol, price, change_percentage, change, day_low, day_high,
                  year_high, year_low, market_cap, price_avg_50, price_avg_200,
                  volume, avg_volume, exchange, open, previous_close,
                  eps, pe, earnings_announcement, shares_outstanding, timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                ON CONFLICT (symbol) DO UPDATE SET
                  price = EXCLUDED.price,
                  change_percentage = EXCLUDED.change_percentage,
                  change = EXCLUDED.change,
                  day_low = EXCLUDED.day_low,
                  day_high = EXCLUDED.day_high,
                  volume = EXCLUDED.volume,
                  timestamp = EXCLUDED.timestamp,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                quote.symbol, quote.price, quote.changesPercentage, quote.change,
                quote.dayLow, quote.dayHigh, quote.yearHigh, quote.yearLow,
                quote.marketCap, quote.priceAvg50, quote.priceAvg200,
                quote.volume, quote.avgVolume, quote.exchange,
                quote.open, quote.previousClose, quote.eps, quote.pe,
                quote.earningsAnnouncement, quote.sharesOutstanding,
                new Date()
              ]);
              successCount++;
            } catch (error) {
              // Continue on error
            }
          }
        }
        
        this.stats.totalRequests++;
      } catch (error) {
        console.error(`Error updating batch: ${error}`);
      }
      
      await this.sleep(500);
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Real-time quotes: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update recent stock prices (last N days)
   */
  async updateRecentPrices(): Promise<void> {
    console.log('\n[3] Updating recent stock prices...');
    this.stats.tablesUpdated.push('stock_prices');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.updateWindow);
    const fromDate = startDate.toISOString().split('T')[0];
    const toDate = new Date().toISOString().split('T')[0];
    
    let successCount = 0;
    let totalRecords = 0;
    const batchSize = 5;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(symbol => 
        this.loader.loadHistoricalPrices(symbol, fromDate, toDate)
      );
      
      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.success) {
          successCount++;
          totalRecords += result.count || 0;
        }
      }
      
      this.stats.totalRequests += batch.length;
      
      if (i + batchSize < this.symbols.length) {
        await this.sleep(1000);
      }
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Recent prices: ${successCount}/${this.symbols.length} symbols, ${totalRecords} records`);
  }

  /**
   * Update today's earnings calendar
   */
  async updateTodaysEarnings(): Promise<void> {
    console.log('\n[4] Updating today\'s earnings...');
    this.stats.tablesUpdated.push('earnings_calendar');
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const data = await this.rateLimiter.makeRequest('/earning_calendar', {
        from: today,
        to: today
      });
      
      if (data && Array.isArray(data)) {
        let insertCount = 0;
        
        for (const earning of data) {
          try {
            await this.db.query(`
              INSERT INTO fmp.earnings_calendar (
                symbol, date, eps, eps_estimated, time, revenue, revenue_estimated,
                fiscal_date_ending, updated_from_date
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (symbol, date) DO UPDATE SET
                eps = EXCLUDED.eps,
                revenue = EXCLUDED.revenue,
                time = EXCLUDED.time
            `, [
              earning.symbol, earning.date, earning.eps, earning.epsEstimated,
              earning.time, earning.revenue, earning.revenueEstimated,
              earning.fiscalDateEnding, earning.updatedFromDate
            ]);
            insertCount++;
          } catch (error) {
            // Continue on error
          }
        }
        
        this.stats.successfulUpdates++;
        this.stats.totalRequests++;
        console.log(`✓ Earnings calendar: ${insertCount} events for today`);
      }
    } catch (error) {
      console.error('Error updating earnings:', error);
    }
  }

  /**
   * Update recent economic calendar events
   */
  async updateEconomicEvents(): Promise<void> {
    console.log('\n[5] Updating economic events...');
    this.stats.tablesUpdated.push('economic_calendar');
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1); // Yesterday
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7); // Next week
    
    try {
      const data = await this.rateLimiter.makeRequest('/economic_calendar', {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      });
      
      if (data && Array.isArray(data)) {
        let insertCount = 0;
        
        for (const event of data) {
          try {
            await this.db.query(`
              INSERT INTO fmp.economic_calendar (
                event, date, country, actual, previous, change,
                change_percentage, estimate, impact
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT DO NOTHING
            `, [
              event.event, event.date, event.country, event.actual,
              event.previous, event.change, event.changePercentage,
              event.estimate, event.impact
            ]);
            insertCount++;
          } catch (error) {
            // Continue on error
          }
        }
        
        this.stats.successfulUpdates++;
        this.stats.totalRequests++;
        console.log(`✓ Economic events: ${insertCount} upcoming events`);
      }
    } catch (error) {
      console.error('Error updating economic events:', error);
    }
  }

  /**
   * Update market indexes
   */
  async updateMarketIndexes(): Promise<void> {
    console.log('\n[6] Updating market indexes...');
    this.stats.tablesUpdated.push('market_indexes', 'index_prices');
    
    const indexes = ['^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX'];
    let successCount = 0;
    
    // Get batch quote for indexes
    try {
      const indexString = indexes.join(',');
      const data = await this.rateLimiter.makeRequest(`/quote/${indexString}`);
      
      if (data && Array.isArray(data)) {
        for (const quote of data) {
          await this.db.query(`
            INSERT INTO fmp.market_indexes (
              symbol, name, price, change_percentage, change,
              day_low, day_high, year_high, year_low, volume
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (symbol) DO UPDATE SET
              price = EXCLUDED.price,
              change_percentage = EXCLUDED.change_percentage,
              change = EXCLUDED.change,
              volume = EXCLUDED.volume,
              updated_at = CURRENT_TIMESTAMP
          `, [
            quote.symbol, quote.name, quote.price, quote.changesPercentage,
            quote.change, quote.dayLow, quote.dayHigh, quote.yearHigh,
            quote.yearLow, quote.volume
          ]);
          successCount++;
        }
      }
      
      this.stats.totalRequests++;
    } catch (error) {
      console.error('Error updating indexes:', error);
    }
    
    // Update recent historical data for indexes
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const fromDate = weekAgo.toISOString().split('T')[0];
    
    for (const index of indexes) {
      try {
        const historical = await this.rateLimiter.makeRequest(
          `/historical-price-full/${index}`,
          { from: fromDate, to: today }
        );
        
        if (historical && historical.historical) {
          for (const price of historical.historical) {
            await this.db.query(`
              INSERT INTO fmp.index_prices (symbol, date, open, high, low, close, volume)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol, date) DO UPDATE SET
                close = EXCLUDED.close,
                volume = EXCLUDED.volume
            `, [
              index, price.date, price.open, price.high,
              price.low, price.close, price.volume
            ]);
          }
        }
        
        this.stats.totalRequests++;
        await this.sleep(200);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Market indexes: ${successCount}/${indexes.length} updated`);
  }

  /**
   * Update latest treasury rates
   */
  async updateTreasuryRates(): Promise<void> {
    console.log('\n[7] Updating treasury rates...');
    this.stats.tablesUpdated.push('treasury_rates');
    
    try {
      const data = await this.rateLimiter.makeRequest('/treasury');
      
      if (data && Array.isArray(data) && data.length > 0) {
        // Get only the most recent rate
        const rate = data[0];
        
        await this.db.query(`
          INSERT INTO fmp.treasury_rates (
            date, month_1, month_2, month_3, month_6,
            year_1, year_2, year_3, year_5, year_7,
            year_10, year_20, year_30
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (date) DO UPDATE SET
            year_10 = EXCLUDED.year_10,
            year_2 = EXCLUDED.year_2
        `, [
          rate.date, rate.month1, rate.month2, rate.month3, rate.month6,
          rate.year1, rate.year2, rate.year3, rate.year5, rate.year7,
          rate.year10, rate.year20, rate.year30
        ]);
        
        this.stats.successfulUpdates++;
        console.log(`✓ Treasury rates: Updated for ${rate.date}`);
      }
      
      this.stats.totalRequests++;
    } catch (error) {
      console.error('Error updating treasury rates:', error);
    }
  }

  /**
   * Update commodity and forex quotes
   */
  async updateCommoditiesAndForex(): Promise<void> {
    console.log('\n[8] Updating commodities and forex...');
    this.stats.tablesUpdated.push('commodity_quotes', 'forex_quotes');
    
    const commodities = ['GCUSD', 'SIUSD', 'CLUSD', 'NGUSD'];
    const forexPairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF'];
    
    // Update commodities
    let commodityCount = 0;
    for (const commodity of commodities) {
      try {
        const data = await this.rateLimiter.makeRequest(`/quote/${commodity}`);
        
        if (data && data.length > 0) {
          const quote = data[0];
          await this.db.query(`
            INSERT INTO fmp.commodity_quotes (
              symbol, name, price, change_percentage, change,
              day_low, day_high, year_low, year_high, volume,
              open, previous_close
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (symbol) DO UPDATE SET
              price = EXCLUDED.price,
              change_percentage = EXCLUDED.change_percentage,
              volume = EXCLUDED.volume,
              updated_at = CURRENT_TIMESTAMP
          `, [
            quote.symbol, quote.name, quote.price, quote.changesPercentage,
            quote.change, quote.dayLow, quote.dayHigh, quote.yearLow,
            quote.yearHigh, quote.volume || 0, quote.open, quote.previousClose
          ]);
          commodityCount++;
        }
        
        this.stats.totalRequests++;
        await this.sleep(200);
      } catch (error) {
        // Continue on error
      }
    }
    
    // Update forex pairs
    let forexCount = 0;
    for (const pair of forexPairs) {
      try {
        const data = await this.rateLimiter.makeRequest(`/quote/${pair}`);
        
        if (data && data.length > 0) {
          const quote = data[0];
          await this.db.query(`
            INSERT INTO fmp.forex_quotes (
              ticker, bid, ask, open, low, high, changes, date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (ticker) DO UPDATE SET
              bid = EXCLUDED.bid,
              ask = EXCLUDED.ask,
              changes = EXCLUDED.changes,
              updated_at = CURRENT_TIMESTAMP
          `, [
            pair, quote.price, quote.price * 1.0001,
            quote.open, quote.dayLow, quote.dayHigh,
            quote.change, new Date()
          ]);
          forexCount++;
        }
        
        this.stats.totalRequests++;
        await this.sleep(200);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += commodityCount + forexCount;
    console.log(`✓ Commodities: ${commodityCount}/${commodities.length} updated`);
    console.log(`✓ Forex: ${forexCount}/${forexPairs.length} updated`);
  }

  /**
   * Check for new quarterly/annual reports
   */
  async updateLatestFinancials(): Promise<void> {
    console.log('\n[9] Checking for new financial reports...');
    this.stats.tablesUpdated.push('financial_statements');
    
    // Only check top 20 symbols for new reports
    const checkSymbols = this.symbols.slice(0, 20);
    let updateCount = 0;
    
    for (const symbol of checkSymbols) {
      try {
        // Check for latest income statement
        const incomeData = await this.rateLimiter.makeRequest(
          `/income-statement/${symbol}`,
          { period: 'quarter', limit: 1 }
        );
        
        if (incomeData && incomeData.length > 0) {
          const latest = incomeData[0];
          
          // Check if this is new data (within last 10 days)
          const reportDate = new Date(latest.date);
          const daysSinceReport = (Date.now() - reportDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceReport <= 10) {
            // This is a new report, update all statements
            console.log(`  New report found for ${symbol}: ${latest.date}`);
            
            // Update income statement
            await this.loader.loadFinancialStatements([symbol], 'income', 'quarter');
            
            // Update balance sheet
            await this.loader.loadFinancialStatements([symbol], 'balance', 'quarter');
            
            // Update cash flow
            await this.loader.loadFinancialStatements([symbol], 'cash-flow', 'quarter');
            
            updateCount++;
            this.stats.totalRequests += 3;
          }
        }
        
        this.stats.totalRequests++;
        await this.sleep(500);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += updateCount;
    console.log(`✓ Financial statements: ${updateCount} companies with new reports`);
  }

  /**
   * Clean up old data (optional)
   */
  async cleanupOldData(): Promise<void> {
    console.log('\n[10] Cleaning up old data...');
    
    try {
      // Remove intraday prices older than 30 days
      const result = await this.db.query(`
        DELETE FROM fmp.intraday_prices 
        WHERE date < CURRENT_DATE - INTERVAL '30 days'
      `);
      
      console.log(`✓ Cleaned up ${result.rowCount} old intraday records`);
    } catch (error) {
      console.error('Error cleaning up data:', error);
    }
  }

  /**
   * Send update summary (for logging/monitoring)
   */
  logSummary(): void {
    const elapsed = ((Date.now() - this.stats.startTime.getTime()) / 1000 / 60).toFixed(1);
    
    const summary = {
      timestamp: new Date().toISOString(),
      duration_minutes: elapsed,
      total_requests: this.stats.totalRequests,
      successful_updates: this.stats.successfulUpdates,
      failed_updates: this.stats.failedUpdates,
      tables_updated: this.stats.tablesUpdated,
      symbols_count: this.symbols.length
    };
    
    // Log to file for monitoring
    const fs = require('fs');
    const logPath = '/tmp/fmp_update_log.json';
    
    try {
      let logs = [];
      if (fs.existsSync(logPath)) {
        const content = fs.readFileSync(logPath, 'utf8');
        logs = JSON.parse(content);
      }
      
      logs.push(summary);
      
      // Keep only last 100 logs
      if (logs.length > 100) {
        logs = logs.slice(-100);
      }
      
      fs.writeFileSync(logPath, JSON.stringify(logs, null, 2));
      
      console.log(`\n${'='.repeat(70)}`);
      console.log(`UPDATE SUMMARY`);
      console.log(`${'='.repeat(70)}`);
      console.log(`Time: ${elapsed} minutes`);
      console.log(`API Requests: ${this.stats.totalRequests}`);
      console.log(`Updates: ${this.stats.successfulUpdates} successful, ${this.stats.failedUpdates} failed`);
      console.log(`Tables: ${this.stats.tablesUpdated.join(', ')}`);
      console.log(`Log saved to: ${logPath}`);
      console.log(`${'='.repeat(70)}\n`);
    } catch (error) {
      console.error('Error saving log:', error);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main execution
   */
  async run(): Promise<void> {
    try {
      await this.db.connect();
      console.log('✓ Database connected\n');
      
      // Execute incremental updates
      await this.getActiveSymbols();
      await this.updateRealTimeQuotes();
      await this.updateRecentPrices();
      await this.updateTodaysEarnings();
      await this.updateEconomicEvents();
      await this.updateMarketIndexes();
      await this.updateTreasuryRates();
      await this.updateCommoditiesAndForex();
      await this.updateLatestFinancials();
      await this.cleanupOldData();
      
      this.logSummary();
      
    } catch (error: any) {
      console.error('\n❌ Fatal error:', error.message);
      console.error(error);
    } finally {
      await this.db.disconnect();
      await this.loader.close();
      process.exit(0);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const updateWindow = args[0] ? parseInt(args[0]) : 7; // Default 7 days

// Run the updater
const updater = new IncrementalDataUpdater(updateWindow);
updater.run().catch(console.error);