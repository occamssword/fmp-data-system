import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPRateLimiter } from '../src/fmp-rate-limiter.js';

config();

/**
 * Advanced FMP Features Updater
 * Adds ESG, Options, Technical Indicators, and other advanced data
 */

class AdvancedFeaturesUpdater {
  private db: DatabaseClient;
  private rateLimiter: FMPRateLimiter;
  private apiKey: string;
  private symbols: string[] = [];

  constructor() {
    this.db = new DatabaseClient();
    this.rateLimiter = new FMPRateLimiter();
    this.apiKey = process.env.FMP_API_KEY || '';
  }

  /**
   * Create tables for advanced features
   */
  async createAdvancedTables(): Promise<void> {
    console.log('Creating advanced feature tables...');
    
    const queries = [
      // ESG Scores
      `CREATE TABLE IF NOT EXISTS fmp.esg_scores (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        date DATE,
        environment_score DECIMAL(8, 4),
        social_score DECIMAL(8, 4),
        governance_score DECIMAL(8, 4),
        esg_score DECIMAL(8, 4),
        rating VARCHAR(10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date),
        FOREIGN KEY (symbol) REFERENCES fmp.companies(symbol) ON DELETE CASCADE
      )`,
      
      // Technical Indicators
      `CREATE TABLE IF NOT EXISTS fmp.technical_indicators (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        date DATE NOT NULL,
        indicator_type VARCHAR(50),
        period INTEGER,
        value DECIMAL(20, 8),
        signal DECIMAL(20, 8),
        histogram DECIMAL(20, 8),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date, indicator_type, period),
        FOREIGN KEY (symbol) REFERENCES fmp.companies(symbol) ON DELETE CASCADE
      )`,
      
      // Options Chain
      `CREATE TABLE IF NOT EXISTS fmp.options_chain (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        expiration_date DATE,
        strike_price DECIMAL(12, 4),
        option_type VARCHAR(4), -- CALL or PUT
        bid DECIMAL(12, 4),
        ask DECIMAL(12, 4),
        last_price DECIMAL(12, 4),
        volume INTEGER,
        open_interest INTEGER,
        implied_volatility DECIMAL(8, 4),
        delta DECIMAL(8, 4),
        gamma DECIMAL(8, 4),
        theta DECIMAL(8, 4),
        vega DECIMAL(8, 4),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, expiration_date, strike_price, option_type)
      )`,
      
      // DCF Valuation
      `CREATE TABLE IF NOT EXISTS fmp.dcf_valuation (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        date DATE,
        stock_price DECIMAL(12, 4),
        dcf_value DECIMAL(12, 4),
        upside_potential DECIMAL(8, 4),
        wacc DECIMAL(8, 4),
        terminal_value BIGINT,
        enterprise_value BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date),
        FOREIGN KEY (symbol) REFERENCES fmp.companies(symbol) ON DELETE CASCADE
      )`,
      
      // Sector Performance
      `CREATE TABLE IF NOT EXISTS fmp.sector_performance (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        sector VARCHAR(100),
        change_percentage DECIMAL(8, 4),
        ytd_return DECIMAL(8, 4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, sector)
      )`,
      
      // Market Movers
      `CREATE TABLE IF NOT EXISTS fmp.market_movers (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        category VARCHAR(50), -- gainers, losers, active
        symbol VARCHAR(10),
        name VARCHAR(255),
        change DECIMAL(12, 4),
        change_percentage DECIMAL(8, 4),
        price DECIMAL(12, 4),
        volume BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (symbol) REFERENCES fmp.companies(symbol) ON DELETE CASCADE
      )`,
      
      // Company Ratings
      `CREATE TABLE IF NOT EXISTS fmp.company_ratings (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        date DATE,
        rating VARCHAR(10),
        rating_score INTEGER,
        rating_recommendation VARCHAR(50),
        rating_details_dcf_score INTEGER,
        rating_details_dcf_recommendation VARCHAR(50),
        rating_details_roe_score INTEGER,
        rating_details_roe_recommendation VARCHAR(50),
        rating_details_roa_score INTEGER,
        rating_details_roa_recommendation VARCHAR(50),
        rating_details_de_score INTEGER,
        rating_details_de_recommendation VARCHAR(50),
        rating_details_pe_score INTEGER,
        rating_details_pe_recommendation VARCHAR(50),
        rating_details_pb_score INTEGER,
        rating_details_pb_recommendation VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date),
        FOREIGN KEY (symbol) REFERENCES fmp.companies(symbol) ON DELETE CASCADE
      )`,
      
      // 13F Institutional Holdings
      `CREATE TABLE IF NOT EXISTS fmp.form_13f_holdings (
        id SERIAL PRIMARY KEY,
        cik VARCHAR(20),
        company_name VARCHAR(255),
        symbol VARCHAR(10),
        shares BIGINT,
        value BIGINT,
        percentage_of_portfolio DECIMAL(8, 4),
        report_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // IPO Calendar Extended
      `CREATE TABLE IF NOT EXISTS fmp.ipo_prospectus (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10),
        company VARCHAR(255),
        date DATE,
        exchange VARCHAR(50),
        price_range_low DECIMAL(12, 4),
        price_range_high DECIMAL(12, 4),
        offering_shares BIGINT,
        total_shares_value BIGINT,
        prospectus_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Earnings Call Transcripts Metadata
      `CREATE TABLE IF NOT EXISTS fmp.earnings_transcripts_meta (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(10) NOT NULL,
        quarter INTEGER,
        year INTEGER,
        date DATE,
        has_transcript BOOLEAN,
        participants INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, quarter, year),
        FOREIGN KEY (symbol) REFERENCES fmp.companies(symbol) ON DELETE CASCADE
      )`
    ];
    
    for (const query of queries) {
      try {
        await this.db.query(query);
      } catch (error: any) {
        console.error('Error creating table:', error.message);
      }
    }
    
    console.log('✓ Advanced feature tables created');
  }

  /**
   * Get active symbols
   */
  async getSymbols(): Promise<void> {
    const result = await this.db.query(`
      SELECT symbol FROM fmp.companies 
      WHERE market_cap IS NOT NULL 
      ORDER BY market_cap DESC 
      LIMIT 30
    `);
    
    this.symbols = result.rows.map(r => r.symbol);
    console.log(`Selected ${this.symbols.length} symbols for advanced features`);
  }

  /**
   * Update ESG scores
   */
  async updateESGScores(): Promise<void> {
    console.log('\nUpdating ESG scores...');
    let successCount = 0;
    
    for (const symbol of this.symbols) {
      try {
        const data = await this.rateLimiter.makeRequest(`/esg-environmental-social-governance-data/${symbol}`);
        
        if (data && Array.isArray(data) && data.length > 0) {
          for (const esg of data) {
            await this.db.query(`
              INSERT INTO fmp.esg_scores (
                symbol, date, environment_score, social_score,
                governance_score, esg_score, rating
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol, date) DO UPDATE SET
                esg_score = EXCLUDED.esg_score,
                rating = EXCLUDED.rating
            `, [
              symbol, esg.date, esg.environmentalScore,
              esg.socialScore, esg.governanceScore,
              esg.ESGScore, esg.rating
            ]);
          }
          successCount++;
        }
        
        await this.sleep(200);
      } catch (error) {
        console.error(`Error updating ESG for ${symbol}:`, error);
      }
    }
    
    console.log(`✓ ESG scores: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update technical indicators (SMA, EMA, RSI, MACD)
   */
  async updateTechnicalIndicators(): Promise<void> {
    console.log('\nUpdating technical indicators...');
    
    const indicators = [
      { type: 'sma', period: 20 },
      { type: 'sma', period: 50 },
      { type: 'sma', period: 200 },
      { type: 'ema', period: 12 },
      { type: 'ema', period: 26 },
      { type: 'rsi', period: 14 }
    ];
    
    let successCount = 0;
    
    for (const symbol of this.symbols.slice(0, 10)) { // Limit to 10 symbols
      for (const indicator of indicators) {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/technical_indicator/${indicator.period}/${symbol}`,
            { type: indicator.type, from: '2024-01-01', to: '2025-08-21' }
          );
          
          if (data && Array.isArray(data)) {
            for (const point of data.slice(0, 30)) { // Last 30 days
              await this.db.query(`
                INSERT INTO fmp.technical_indicators (
                  symbol, date, indicator_type, period, value
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (symbol, date, indicator_type, period) DO UPDATE SET
                  value = EXCLUDED.value
              `, [
                symbol, point.date, indicator.type.toUpperCase(),
                indicator.period, point[indicator.type] || point.value
              ]);
            }
            successCount++;
          }
          
          await this.sleep(100);
        } catch (error) {
          // Continue on error
        }
      }
    }
    
    console.log(`✓ Technical indicators: ${successCount} indicator sets updated`);
  }

  /**
   * Update DCF valuations
   */
  async updateDCFValuations(): Promise<void> {
    console.log('\nUpdating DCF valuations...');
    let successCount = 0;
    
    for (const symbol of this.symbols) {
      try {
        const data = await this.rateLimiter.makeRequest(`/discounted-cash-flow/${symbol}`);
        
        if (data && Array.isArray(data) && data.length > 0) {
          const dcf = data[0];
          
          await this.db.query(`
            INSERT INTO fmp.dcf_valuation (
              symbol, date, stock_price, dcf_value, upside_potential
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (symbol, date) DO UPDATE SET
              dcf_value = EXCLUDED.dcf_value,
              upside_potential = EXCLUDED.upside_potential
          `, [
            symbol, dcf.date, dcf.Stock_Price,
            dcf.dcf, ((dcf.dcf - dcf.Stock_Price) / dcf.Stock_Price * 100)
          ]);
          successCount++;
        }
        
        await this.sleep(200);
      } catch (error) {
        // Continue on error
      }
    }
    
    console.log(`✓ DCF valuations: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update company ratings
   */
  async updateCompanyRatings(): Promise<void> {
    console.log('\nUpdating company ratings...');
    let successCount = 0;
    
    for (const symbol of this.symbols) {
      try {
        const data = await this.rateLimiter.makeRequest(`/rating/${symbol}`);
        
        if (data && Array.isArray(data) && data.length > 0) {
          const rating = data[0];
          
          await this.db.query(`
            INSERT INTO fmp.company_ratings (
              symbol, date, rating, rating_score, rating_recommendation,
              rating_details_dcf_score, rating_details_dcf_recommendation,
              rating_details_roe_score, rating_details_roe_recommendation,
              rating_details_pe_score, rating_details_pe_recommendation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (symbol, date) DO UPDATE SET
              rating = EXCLUDED.rating,
              rating_score = EXCLUDED.rating_score
          `, [
            symbol, rating.date, rating.rating, rating.ratingScore,
            rating.ratingRecommendation,
            rating.ratingDetailsDCFScore, rating.ratingDetailsDCFRecommendation,
            rating.ratingDetailsROEScore, rating.ratingDetailsROERecommendation,
            rating.ratingDetailsPEScore, rating.ratingDetailsPERecommendation
          ]);
          successCount++;
        }
        
        await this.sleep(200);
      } catch (error) {
        // Continue on error
      }
    }
    
    console.log(`✓ Company ratings: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update sector performance
   */
  async updateSectorPerformance(): Promise<void> {
    console.log('\nUpdating sector performance...');
    
    try {
      const data = await this.rateLimiter.makeRequest('/sectors-performance');
      
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        const sectors = Object.entries(data);
        
        for (const [sector, performance] of sectors) {
          if (typeof performance === 'string') {
            const changePercent = parseFloat(performance.replace('%', ''));
            
            await this.db.query(`
              INSERT INTO fmp.sector_performance (
                date, sector, change_percentage
              ) VALUES ($1, $2, $3)
              ON CONFLICT (date, sector) DO UPDATE SET
                change_percentage = EXCLUDED.change_percentage
            `, [today, sector, changePercent]);
          }
        }
        
        console.log(`✓ Sector performance: ${sectors.length} sectors updated`);
      }
    } catch (error) {
      console.error('Error updating sector performance:', error);
    }
  }

  /**
   * Update market movers (gainers, losers, active)
   */
  async updateMarketMovers(): Promise<void> {
    console.log('\nUpdating market movers...');
    
    const categories = [
      { type: 'gainers', endpoint: '/stock_market/gainers' },
      { type: 'losers', endpoint: '/stock_market/losers' },
      { type: 'actives', endpoint: '/stock_market/actives' }
    ];
    
    const today = new Date().toISOString().split('T')[0];
    let totalCount = 0;
    
    for (const category of categories) {
      try {
        const data = await this.rateLimiter.makeRequest(category.endpoint);
        
        if (data && Array.isArray(data)) {
          for (const mover of data.slice(0, 20)) { // Top 20 of each
            // First ensure symbol exists in companies table
            await this.db.query(`
              INSERT INTO fmp.companies (symbol, name, exchange)
              VALUES ($1, $2, $3)
              ON CONFLICT (symbol) DO NOTHING
            `, [mover.symbol, mover.name, mover.exchange || 'UNKNOWN']);
            
            await this.db.query(`
              INSERT INTO fmp.market_movers (
                date, category, symbol, name, change,
                change_percentage, price, volume
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT DO NOTHING
            `, [
              today, category.type, mover.symbol, mover.name,
              mover.change, mover.changesPercentage,
              mover.price, mover.volume
            ]);
            totalCount++;
          }
        }
        
        await this.sleep(500);
      } catch (error) {
        console.error(`Error updating ${category.type}:`, error);
      }
    }
    
    console.log(`✓ Market movers: ${totalCount} entries updated`);
  }

  /**
   * Update options chain for top symbols
   */
  async updateOptionsChain(): Promise<void> {
    console.log('\nUpdating options chain...');
    let successCount = 0;
    
    // Only update options for top 5 most liquid symbols
    const optionSymbols = this.symbols.slice(0, 5);
    
    for (const symbol of optionSymbols) {
      try {
        const expirations = await this.rateLimiter.makeRequest(
          `/options/expiration/${symbol}`
        );
        
        if (expirations && Array.isArray(expirations) && expirations.length > 0) {
          // Get options for next expiration only
          const nextExpiry = expirations[0];
          
          const chain = await this.rateLimiter.makeRequest(
            `/options-chain/${symbol}`,
            { date: nextExpiry }
          );
          
          if (chain && Array.isArray(chain)) {
            for (const option of chain.slice(0, 50)) { // Limit to 50 strikes
              await this.db.query(`
                INSERT INTO fmp.options_chain (
                  symbol, expiration_date, strike_price, option_type,
                  bid, ask, last_price, volume, open_interest,
                  implied_volatility
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (symbol, expiration_date, strike_price, option_type) 
                DO UPDATE SET
                  bid = EXCLUDED.bid,
                  ask = EXCLUDED.ask,
                  last_price = EXCLUDED.last_price,
                  volume = EXCLUDED.volume,
                  open_interest = EXCLUDED.open_interest,
                  updated_at = CURRENT_TIMESTAMP
              `, [
                symbol, option.expirationDate, option.strike,
                option.type, option.bid, option.ask,
                option.lastTradePrice, option.volume,
                option.openInterest, option.impliedVolatility
              ]);
            }
            successCount++;
          }
        }
        
        await this.sleep(1000);
      } catch (error) {
        console.error(`Error updating options for ${symbol}:`, error);
      }
    }
    
    console.log(`✓ Options chain: ${successCount}/${optionSymbols.length} symbols updated`);
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
      console.log('='.repeat(70));
      console.log('FMP Advanced Features Update');
      console.log('='.repeat(70));
      
      await this.db.connect();
      console.log('✓ Database connected\n');
      
      // Create tables
      await this.createAdvancedTables();
      
      // Get symbols
      await this.getSymbols();
      
      // Update advanced features
      await this.updateESGScores();
      await this.updateTechnicalIndicators();
      await this.updateDCFValuations();
      await this.updateCompanyRatings();
      await this.updateSectorPerformance();
      await this.updateMarketMovers();
      await this.updateOptionsChain();
      
      console.log('\n' + '='.repeat(70));
      console.log('Advanced features update complete!');
      console.log('='.repeat(70));
      
    } catch (error: any) {
      console.error('\n❌ Fatal error:', error.message);
      console.error(error);
    } finally {
      await this.db.disconnect();
      process.exit(0);
    }
  }
}

// Run the updater
const updater = new AdvancedFeaturesUpdater();
updater.run().catch(console.error);