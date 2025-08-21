import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPDataLoader, FMPRateLimiter } from '../src/fmp-rate-limiter.js';
import axios from 'axios';

config();

/**
 * Update FMP data for the past 2 years across all major tables
 * Respects rate limits: 3000 requests per minute
 */

class TwoYearDataUpdater {
  private db: DatabaseClient;
  private loader: FMPDataLoader;
  private rateLimiter: FMPRateLimiter;
  private apiKey: string;
  private startDate: string;
  private endDate: string;
  private symbols: string[] = [];
  private stats = {
    totalRequests: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    tablesUpdated: [] as string[],
    startTime: new Date()
  };

  constructor() {
    this.db = new DatabaseClient();
    this.loader = new FMPDataLoader(this.db.pool);
    this.rateLimiter = new FMPRateLimiter();
    this.apiKey = process.env.FMP_API_KEY || '';
    
    // Set date range for 2 years
    const today = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(today.getFullYear() - 2);
    
    this.endDate = today.toISOString().split('T')[0];
    this.startDate = twoYearsAgo.toISOString().split('T')[0];
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`FMP 2-Year Data Update`);
    console.log(`Date Range: ${this.startDate} to ${this.endDate}`);
    console.log(`Rate Limit: 3000 requests/minute (using 2800 to be safe)`);
    console.log(`${'='.repeat(70)}\n`);
  }

  /**
   * Get list of symbols to update
   */
  async getSymbolsList(): Promise<void> {
    console.log('[Step 1] Fetching symbols list...');
    
    try {
      // First try to get from database
      const dbResult = await this.db.query(`
        SELECT DISTINCT symbol, market_cap 
        FROM fmp.companies 
        WHERE symbol IS NOT NULL 
        ORDER BY market_cap DESC NULLS LAST
        LIMIT 100
      `);
      
      if (dbResult.rows.length > 0) {
        this.symbols = dbResult.rows.map(r => r.symbol);
        console.log(`Found ${this.symbols.length} symbols in database`);
      }
      
      // If no symbols in DB, fetch from API
      if (this.symbols.length === 0) {
        const response = await this.rateLimiter.makeRequest('/stock/list');
        if (response && Array.isArray(response)) {
          // Get top 100 most traded stocks
          const filtered = response
            .filter((s: any) => s.exchangeShortName === 'NASDAQ' || s.exchangeShortName === 'NYSE')
            .slice(0, 100);
          
          this.symbols = filtered.map((s: any) => s.symbol);
          console.log(`Fetched ${this.symbols.length} symbols from API`);
          
          // Save to database
          await this.saveSymbolsList(filtered);
        }
      }
      
      // Focus on major stocks for the 2-year update
      const majorSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 
                           'JPM', 'V', 'JNJ', 'WMT', 'PG', 'UNH', 'DIS', 'MA',
                           'HD', 'BAC', 'XOM', 'PFE', 'ABBV', 'KO', 'PEP', 'TMO',
                           'AVGO', 'CSCO', 'CVX', 'LLY', 'ACN', 'COST', 'NKE'];
      
      // Prioritize major symbols
      this.symbols = [...new Set([...majorSymbols, ...this.symbols])].slice(0, 50);
      
      console.log(`Selected ${this.symbols.length} symbols for update:`, this.symbols.slice(0, 10).join(', '), '...');
      
    } catch (error: any) {
      console.error('Error fetching symbols:', error.message);
      // Use fallback list
      this.symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
    }
  }

  /**
   * Save symbols list to database
   */
  async saveSymbolsList(symbols: any[]): Promise<void> {
    console.log('Saving symbols list to database...');
    
    for (const symbol of symbols) {
      try {
        await this.db.query(`
          INSERT INTO fmp.symbols_list (symbol, name, price, exchange, exchange_short_name, type)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (symbol) DO UPDATE SET
            price = EXCLUDED.price,
            created_at = CURRENT_TIMESTAMP
        `, [symbol.symbol, symbol.name, symbol.price, symbol.exchange, symbol.exchangeShortName, symbol.type]);
      } catch (error) {
        // Continue on error
      }
    }
  }

  /**
   * Update company profiles
   */
  async updateCompanyProfiles(): Promise<void> {
    console.log('\n[Step 2] Updating company profiles...');
    this.stats.tablesUpdated.push('companies');
    
    const results = await this.loader.loadCompanyProfiles(this.symbols);
    const successful = results.filter(r => r.success).length;
    
    this.stats.successfulUpdates += successful;
    this.stats.failedUpdates += results.length - successful;
    this.stats.totalRequests += results.length;
    
    console.log(`✓ Company profiles: ${successful}/${this.symbols.length} updated`);
  }

  /**
   * Update historical stock prices (2 years)
   */
  async updateHistoricalPrices(): Promise<void> {
    console.log('\n[Step 3] Updating 2-year historical prices...');
    this.stats.tablesUpdated.push('stock_prices');
    
    let successCount = 0;
    let totalRecords = 0;
    
    // Process in smaller batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(this.symbols.length/batchSize)}...`);
      
      const promises = batch.map(symbol => 
        this.loader.loadHistoricalPrices(symbol, this.startDate, this.endDate)
      );
      
      const results = await Promise.all(promises);
      
      for (const result of results) {
        if (result.success) {
          successCount++;
          totalRecords += result.count || 0;
        }
      }
      
      this.stats.totalRequests += batch.length;
      
      // Pause between batches
      if (i + batchSize < this.symbols.length) {
        console.log('Pausing between batches (2s)...');
        await this.sleep(2000);
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.failedUpdates += this.symbols.length - successCount;
    
    console.log(`✓ Historical prices: ${successCount}/${this.symbols.length} symbols, ${totalRecords} total records`);
  }

  /**
   * Update financial statements (Income, Balance, Cash Flow)
   */
  async updateFinancialStatements(): Promise<void> {
    console.log('\n[Step 4] Updating financial statements...');
    
    const statementTypes: Array<'income' | 'balance' | 'cash-flow'> = ['income', 'balance', 'cash-flow'];
    const periods: Array<'annual' | 'quarter'> = ['annual', 'quarter'];
    
    for (const type of statementTypes) {
      for (const period of periods) {
        console.log(`\nUpdating ${period} ${type} statements...`);
        this.stats.tablesUpdated.push(`${type}_statements_${period}`);
        
        // Process in smaller batches
        const batchSize = 3;
        let successCount = 0;
        
        for (let i = 0; i < this.symbols.length; i += batchSize) {
          const batch = this.symbols.slice(i, i + batchSize);
          
          try {
            const results = await this.loader.loadFinancialStatements(batch, type, period);
            successCount += results.filter(r => r.success).length;
            this.stats.totalRequests += batch.length;
          } catch (error) {
            console.error(`Error processing ${type} statements:`, error);
          }
          
          // Rate limit pause
          if (i + batchSize < this.symbols.length) {
            await this.sleep(1500);
          }
        }
        
        this.stats.successfulUpdates += successCount;
        console.log(`✓ ${period} ${type}: ${successCount}/${this.symbols.length} updated`);
      }
    }
  }

  /**
   * Update key metrics
   */
  async updateKeyMetrics(): Promise<void> {
    console.log('\n[Step 5] Updating key metrics...');
    this.stats.tablesUpdated.push('key_metrics');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/key-metrics/${symbol}`,
            { period: 'annual', limit: 10 }
          );
          
          if (data && data.length > 0) {
            // Insert metrics into database
            for (const metric of data) {
              await this.db.query(`
                INSERT INTO fmp.key_metrics (
                  symbol, date, period, pe_ratio, price_to_sales_ratio, 
                  pb_ratio, debt_to_equity, current_ratio, return_on_equity,
                  return_on_assets, gross_profit_margin, operating_profit_margin,
                  net_profit_margin, dividend_yield, market_cap, enterprise_value
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                ON CONFLICT (symbol, date, period) DO UPDATE SET
                  pe_ratio = EXCLUDED.pe_ratio,
                  market_cap = EXCLUDED.market_cap
              `, [
                symbol, metric.date, metric.period || 'FY',
                metric.peRatio, metric.priceToSalesRatio, metric.pbRatio,
                metric.debtToEquity, metric.currentRatio, metric.returnOnEquity,
                metric.returnOnAssets, metric.grossProfitMargin, metric.operatingProfitMargin,
                metric.netProfitMargin, metric.dividendYield, metric.marketCap,
                metric.enterpriseValue
              ]);
            }
            return true;
          }
          return false;
        } catch (error) {
          return false;
        }
      });
      
      const results = await Promise.all(promises);
      successCount += results.filter(r => r).length;
      this.stats.totalRequests += batch.length;
      
      if (i + batchSize < this.symbols.length) {
        await this.sleep(1500);
      }
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Key metrics: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update analyst estimates
   */
  async updateAnalystEstimates(): Promise<void> {
    console.log('\n[Step 6] Updating analyst estimates...');
    this.stats.tablesUpdated.push('analyst_estimates');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < Math.min(this.symbols.length, 20); i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/analyst-estimates/${symbol}`,
            { period: 'annual', limit: 5 }
          );
          
          if (data && data.length > 0) {
            for (const estimate of data) {
              await this.db.query(`
                INSERT INTO fmp.analyst_estimates (
                  symbol, date, estimated_revenue_avg, estimated_ebitda_avg,
                  estimated_net_income_avg, estimated_eps_avg,
                  number_analyst_estimated_revenue, number_analysts_estimated_eps
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  estimated_eps_avg = EXCLUDED.estimated_eps_avg
              `, [
                symbol, estimate.date, estimate.estimatedRevenueAvg,
                estimate.estimatedEbitdaAvg, estimate.estimatedNetIncomeAvg,
                estimate.estimatedEpsAvg, estimate.numberAnalystEstimatedRevenue,
                estimate.numberAnalystsEstimatedEps
              ]);
            }
            return true;
          }
          return false;
        } catch (error) {
          return false;
        }
      });
      
      const results = await Promise.all(promises);
      successCount += results.filter(r => r).length;
      this.stats.totalRequests += batch.length;
      
      await this.sleep(1500);
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Analyst estimates: ${successCount}/20 updated`);
  }

  /**
   * Update economic calendar (2 years)
   */
  async updateEconomicCalendar(): Promise<void> {
    console.log('\n[Step 7] Updating economic calendar...');
    this.stats.tablesUpdated.push('economic_calendar');
    
    try {
      const data = await this.rateLimiter.makeRequest('/economic_calendar', {
        from: this.startDate,
        to: this.endDate
      });
      
      if (data && Array.isArray(data)) {
        let insertCount = 0;
        
        for (const event of data.slice(0, 500)) { // Limit to recent 500 events
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
        console.log(`✓ Economic calendar: ${insertCount} events added`);
      }
    } catch (error) {
      console.error('Error updating economic calendar:', error);
      this.stats.failedUpdates++;
    }
  }

  /**
   * Update market indexes
   */
  async updateMarketIndexes(): Promise<void> {
    console.log('\n[Step 8] Updating market indexes...');
    this.stats.tablesUpdated.push('market_indexes');
    
    const indexes = ['^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX'];
    let successCount = 0;
    
    for (const index of indexes) {
      try {
        const data = await this.rateLimiter.makeRequest(`/quote/${index}`);
        
        if (data && data.length > 0) {
          const quote = data[0];
          await this.db.query(`
            INSERT INTO fmp.market_indexes (
              symbol, name, price, change_percentage, change,
              day_low, day_high, year_high, year_low, volume
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (symbol) DO UPDATE SET
              price = EXCLUDED.price,
              change_percentage = EXCLUDED.change_percentage,
              updated_at = CURRENT_TIMESTAMP
          `, [
            quote.symbol, quote.name, quote.price, quote.changesPercentage,
            quote.change, quote.dayLow, quote.dayHigh, quote.yearHigh,
            quote.yearLow, quote.volume
          ]);
          successCount++;
        }
        
        // Also get historical data
        const historical = await this.rateLimiter.makeRequest(
          `/historical-price-full/${index}`,
          { from: this.startDate, to: this.endDate }
        );
        
        if (historical && historical.historical) {
          for (const price of historical.historical) {
            await this.db.query(`
              INSERT INTO fmp.index_prices (symbol, date, open, high, low, close, volume)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol, date) DO UPDATE SET
                close = EXCLUDED.close
            `, [
              index, price.date, price.open, price.high,
              price.low, price.close, price.volume
            ]);
          }
        }
        
        this.stats.totalRequests += 2;
        await this.sleep(500);
      } catch (error) {
        console.error(`Error updating index ${index}:`, error);
      }
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Market indexes: ${successCount}/${indexes.length} updated`);
  }

  /**
   * Print final summary
   */
  printSummary(): void {
    const elapsed = ((Date.now() - this.stats.startTime.getTime()) / 1000 / 60).toFixed(1);
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`UPDATE COMPLETE`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Time Elapsed: ${elapsed} minutes`);
    console.log(`Total API Requests: ${this.stats.totalRequests}`);
    console.log(`Successful Updates: ${this.stats.successfulUpdates}`);
    console.log(`Failed Updates: ${this.stats.failedUpdates}`);
    console.log(`Tables Updated: ${this.stats.tablesUpdated.join(', ')}`);
    console.log(`Date Range: ${this.startDate} to ${this.endDate}`);
    console.log(`Symbols Processed: ${this.symbols.length}`);
    console.log(`${'='.repeat(70)}\n`);
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
      
      // Start monitoring
      this.loader.startMonitoring(30000); // Log every 30 seconds
      
      // Execute updates in sequence
      await this.getSymbolsList();
      await this.updateCompanyProfiles();
      await this.updateHistoricalPrices();
      await this.updateFinancialStatements();
      await this.updateKeyMetrics();
      await this.updateAnalystEstimates();
      await this.updateEconomicCalendar();
      await this.updateMarketIndexes();
      
      this.printSummary();
      
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

// Run the updater
const updater = new TwoYearDataUpdater();
updater.run().catch(console.error);