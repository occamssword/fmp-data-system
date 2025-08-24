import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPDataLoader } from '../src/fmp-rate-limiter.js';

config();

/**
 * Corporate Events Data Loader
 * Loads bankruptcies, delistings, M&A deals, and share buybacks
 */
class CorporateEventsLoader {
  private loader: FMPDataLoader;
  private db: DatabaseClient;
  private stats = {
    bankruptciesLoaded: 0,
    delistingsLoaded: 0,
    maDealsLoaded: 0,
    buybacksLoaded: 0,
    failToDeliverLoaded: 0,
    errors: 0
  };

  constructor() {
    this.db = new DatabaseClient();
    this.loader = new FMPDataLoader(this.db.pool);
  }

  /**
   * Load bankruptcy data
   */
  async loadBankruptcies(): Promise<void> {
    console.log('\n[Bankruptcies] Loading bankruptcy filings...');
    
    try {
      const data = await this.loader.rateLimiter.makeRequest('/bankruptcies-rss-feed', {
        limit: 100
      });

      if (!data || !Array.isArray(data)) {
        console.log('No bankruptcy data available');
        return;
      }

      for (const bankruptcy of data) {
        try {
          await this.db.query(`
            INSERT INTO fmp.bankruptcies (
              symbol, company_name, filing_date, chapter,
              assets_value, liabilities_value, court,
              case_number, emergence_date, outcome
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT DO NOTHING
          `, [
            bankruptcy.symbol,
            bankruptcy.companyName,
            bankruptcy.filingDate ? new Date(bankruptcy.filingDate) : null,
            bankruptcy.chapter,
            bankruptcy.assetsValue,
            bankruptcy.liabilitiesValue,
            bankruptcy.court,
            bankruptcy.caseNumber,
            bankruptcy.emergenceDate ? new Date(bankruptcy.emergenceDate) : null,
            bankruptcy.outcome
          ]);
          
          this.stats.bankruptciesLoaded++;
        } catch (error: any) {
          console.error(`Error loading bankruptcy for ${bankruptcy.companyName}:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.bankruptciesLoaded} bankruptcy filings`);
    } catch (error: any) {
      console.error('Error loading bankruptcies:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load delisting data
   */
  async loadDelistings(): Promise<void> {
    console.log('\n[Delistings] Loading delisted companies...');
    
    try {
      const data = await this.loader.rateLimiter.makeRequest('/delisted-companies', {
        limit: 200
      });

      if (!data || !Array.isArray(data)) {
        console.log('No delisting data available');
        return;
      }

      for (const delisting of data) {
        try {
          await this.db.query(`
            INSERT INTO fmp.delistings (
              symbol, company_name, exchange,
              delisting_date, reason, ipo_date,
              last_price, market_cap_at_delisting
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT DO NOTHING
          `, [
            delisting.symbol,
            delisting.companyName,
            delisting.exchange,
            delisting.delistingDate ? new Date(delisting.delistingDate) : null,
            delisting.reason,
            delisting.ipoDate ? new Date(delisting.ipoDate) : null,
            delisting.lastPrice,
            delisting.marketCapAtDelisting
          ]);
          
          this.stats.delistingsLoaded++;
        } catch (error: any) {
          console.error(`Error loading delisting for ${delisting.symbol}:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.delistingsLoaded} delistings`);
    } catch (error: any) {
      console.error('Error loading delistings:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load M&A deals
   */
  async loadMADeals(): Promise<void> {
    console.log('\n[M&A] Loading mergers and acquisitions...');
    
    try {
      const data = await this.loader.rateLimiter.makeRequest('/mergers-acquisitions', {
        limit: 200
      });

      if (!data || !Array.isArray(data)) {
        console.log('No M&A data available');
        return;
      }

      for (const deal of data) {
        try {
          await this.db.query(`
            INSERT INTO fmp.ma_deals (
              acquirer_symbol, acquirer_name, target_symbol, target_name,
              announcement_date, completion_date, deal_value,
              deal_type, payment_method, deal_status,
              premium_percentage, synergies_value
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT DO NOTHING
          `, [
            deal.acquirerSymbol,
            deal.acquirerName,
            deal.targetSymbol,
            deal.targetName,
            deal.announcementDate ? new Date(deal.announcementDate) : null,
            deal.completionDate ? new Date(deal.completionDate) : null,
            deal.dealValue,
            deal.dealType,
            deal.paymentMethod,
            deal.status,
            deal.premiumPercentage,
            deal.synergiesValue
          ]);
          
          this.stats.maDealsLoaded++;
        } catch (error: any) {
          console.error(`Error loading M&A deal:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.maDealsLoaded} M&A deals`);
    } catch (error: any) {
      console.error('Error loading M&A deals:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load fail to deliver data
   */
  async loadFailToDeliver(): Promise<void> {
    console.log('\n[FTD] Loading fail-to-deliver data...');
    
    try {
      // Get heavily shorted stocks
      const shortedStocks = ['GME', 'AMC', 'BBBY', 'BB', 'NOK', 'PLTR', 'TSLA', 'AAPL'];
      
      for (const symbol of shortedStocks) {
        try {
          const data = await this.loader.rateLimiter.makeRequest(
            `/fail-to-deliver/${symbol}`,
            { limit: 30 }
          );

          if (data && Array.isArray(data)) {
            for (const ftd of data) {
              await this.db.query(`
                INSERT INTO fmp.fail_to_deliver (
                  symbol, date, quantity, price,
                  total_value, cusip
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  quantity = EXCLUDED.quantity,
                  total_value = EXCLUDED.total_value
              `, [
                symbol,
                ftd.date ? new Date(ftd.date) : null,
                ftd.quantity,
                ftd.price,
                ftd.totalValue,
                ftd.cusip
              ]);
              
              this.stats.failToDeliverLoaded++;
            }
          }
          
          await this.sleep(100);
        } catch (error: any) {
          // Continue on error - not all stocks have FTD data
          if (!error.message.includes('404')) {
            console.error(`Error loading FTD for ${symbol}:`, error.message);
            this.stats.errors++;
          }
        }
      }
      
      console.log(`✓ Loaded ${this.stats.failToDeliverLoaded} fail-to-deliver records`);
    } catch (error: any) {
      console.error('Error loading fail-to-deliver data:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Analyze corporate events
   */
  async analyzeCorporateEvents(): Promise<void> {
    console.log('\n[Analysis] Analyzing corporate events...');
    
    try {
      // Recent bankruptcies
      const recentBankruptcies = await this.db.query(`
        SELECT company_name, filing_date, chapter, 
               assets_value, liabilities_value
        FROM fmp.bankruptcies
        WHERE filing_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY filing_date DESC
        LIMIT 5
      `);

      if (recentBankruptcies.rows.length > 0) {
        console.log('\nRecent Bankruptcy Filings:');
        console.log('Company | Date | Chapter | Assets | Liabilities');
        console.log('-'.repeat(60));
        for (const b of recentBankruptcies.rows) {
          const assets = b.assets_value ? `$${(b.assets_value/1000000).toFixed(1)}M` : 'N/A';
          const liabilities = b.liabilities_value ? `$${(b.liabilities_value/1000000).toFixed(1)}M` : 'N/A';
          console.log(`${b.company_name?.substring(0, 20).padEnd(20)} | ${b.filing_date?.toISOString().split('T')[0]} | ${b.chapter?.padEnd(7)} | ${assets.padEnd(8)} | ${liabilities}`);
        }
      }

      // Recent M&A activity
      const recentMA = await this.db.query(`
        SELECT acquirer_name, target_name, deal_value, deal_status, announcement_date
        FROM fmp.ma_deals
        WHERE announcement_date >= CURRENT_DATE - INTERVAL '30 days'
          AND deal_value > 1000000000
        ORDER BY deal_value DESC
        LIMIT 5
      `);

      if (recentMA.rows.length > 0) {
        console.log('\nRecent Major M&A Deals (>$1B):');
        for (const deal of recentMA.rows) {
          const value = deal.deal_value ? `$${(deal.deal_value/1000000000).toFixed(1)}B` : 'Undisclosed';
          console.log(`${deal.acquirer_name} acquiring ${deal.target_name} for ${value} (${deal.deal_status})`);
        }
      }

      // High fail-to-deliver stocks
      const highFTD = await this.db.query(`
        SELECT symbol, SUM(quantity) as total_ftd, 
               AVG(total_value) as avg_value
        FROM fmp.fail_to_deliver
        WHERE date >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY symbol
        HAVING SUM(quantity) > 100000
        ORDER BY SUM(quantity) DESC
        LIMIT 5
      `);

      if (highFTD.rows.length > 0) {
        console.log('\nHigh Fail-to-Deliver Stocks (Last 30 Days):');
        console.log('Symbol | Total FTD | Avg Value');
        console.log('-'.repeat(35));
        for (const ftd of highFTD.rows) {
          const avgVal = ftd.avg_value ? `$${(ftd.avg_value/1000000).toFixed(1)}M` : 'N/A';
          console.log(`${ftd.symbol.padEnd(6)} | ${ftd.total_ftd.toString().padEnd(9)} | ${avgVal}`);
        }
      }
    } catch (error: any) {
      console.error('Error analyzing corporate events:', error.message);
    }
  }

  /**
   * Print summary statistics
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('CORPORATE EVENTS LOADER SUMMARY');
    console.log('='.repeat(60));
    console.log(`Bankruptcies Loaded: ${this.stats.bankruptciesLoaded}`);
    console.log(`Delistings Loaded: ${this.stats.delistingsLoaded}`);
    console.log(`M&A Deals Loaded: ${this.stats.maDealsLoaded}`);
    console.log(`Fail-to-Deliver Records: ${this.stats.failToDeliverLoaded}`);
    console.log(`Total Records: ${this.stats.bankruptciesLoaded + this.stats.delistingsLoaded + this.stats.maDealsLoaded + this.stats.failToDeliverLoaded}`);
    console.log(`Errors Encountered: ${this.stats.errors}`);
    console.log('='.repeat(60));
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
      console.log('✓ Database connected');
      
      console.log('\n' + '='.repeat(60));
      console.log('LOADING CORPORATE EVENTS DATA');
      console.log('='.repeat(60));
      
      // Load all corporate events
      await this.loadBankruptcies();
      await this.loadDelistings();
      await this.loadMADeals();
      await this.loadFailToDeliver();
      
      // Analyze events
      await this.analyzeCorporateEvents();
      
      this.printSummary();
      
    } catch (error: any) {
      console.error('Fatal error:', error.message);
      console.error(error);
    } finally {
      await this.db.disconnect();
      process.exit(0);
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const loader = new CorporateEventsLoader();
  loader.run().catch(console.error);
}

export { CorporateEventsLoader };