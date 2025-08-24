import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPDataLoader } from '../src/fmp-rate-limiter.js';

config();

/**
 * Bonds and Fixed Income Data Loader
 * Loads bond prices, yields, ratings, and treasury data
 */
class BondsDataLoader {
  private loader: FMPDataLoader;
  private db: DatabaseClient;
  private stats = {
    bondsLoaded: 0,
    pricesLoaded: 0,
    treasuryLoaded: 0,
    ratingsLoaded: 0,
    errors: 0
  };

  constructor() {
    this.db = new DatabaseClient();
    this.loader = new FMPDataLoader(this.db.pool);
  }

  /**
   * Load bond list and specifications
   */
  async loadBondsList(): Promise<void> {
    console.log('\n[Bonds] Loading bond specifications...');
    
    try {
      const bonds = await this.loader.rateLimiter.makeRequest('/bonds-list');
      
      if (!bonds || !Array.isArray(bonds)) {
        console.log('No bonds data available');
        return;
      }

      for (const bond of bonds) {
        try {
          await this.db.query(`
            INSERT INTO fmp.bonds (
              cusip, isin, symbol, issuer_name, bond_type,
              maturity_date, coupon_rate, face_value, currency,
              rating_sp, rating_moodys, rating_fitch,
              callable, convertible
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (cusip) DO UPDATE SET
              rating_sp = EXCLUDED.rating_sp,
              rating_moodys = EXCLUDED.rating_moodys,
              rating_fitch = EXCLUDED.rating_fitch,
              created_at = CURRENT_TIMESTAMP
          `, [
            bond.cusip,
            bond.isin,
            bond.symbol,
            bond.issuerName,
            bond.bondType,
            bond.maturityDate ? new Date(bond.maturityDate) : null,
            bond.couponRate,
            bond.faceValue,
            bond.currency,
            bond.ratingS_P,
            bond.ratingMoodys,
            bond.ratingFitch,
            bond.callable || false,
            bond.convertible || false
          ]);
          
          this.stats.bondsLoaded++;
        } catch (error: any) {
          console.error(`Error loading bond ${bond.cusip}:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.bondsLoaded} bond specifications`);
    } catch (error: any) {
      console.error('Error loading bonds list:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load historical bond prices
   */
  async loadBondPrices(symbols: string[] = []): Promise<void> {
    console.log('\n[Bonds] Loading bond price history...');
    
    // If no symbols provided, get from database
    if (symbols.length === 0) {
      const result = await this.db.query(`
        SELECT DISTINCT cusip FROM fmp.bonds 
        WHERE cusip IS NOT NULL 
        LIMIT 20
      `);
      symbols = result.rows.map(r => r.cusip);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    for (const cusip of symbols) {
      try {
        const data = await this.loader.rateLimiter.makeRequest(
          `/historical-price-full/${cusip}`,
          {
            from: startDate.toISOString().split('T')[0],
            to: endDate.toISOString().split('T')[0]
          }
        );

        if (data && data.historical && Array.isArray(data.historical)) {
          for (const price of data.historical) {
            await this.db.query(`
              INSERT INTO fmp.bond_prices (
                cusip, date, price, yield, spread,
                duration, convexity, volume
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT (cusip, date) DO UPDATE SET
                price = EXCLUDED.price,
                yield = EXCLUDED.yield
            `, [
              cusip,
              new Date(price.date),
              price.close || price.price,
              price.yield,
              price.spread,
              price.duration,
              price.convexity,
              price.volume
            ]);
            
            this.stats.pricesLoaded++;
          }
        }
        
        await this.sleep(100);
      } catch (error: any) {
        console.error(`Error loading prices for ${cusip}:`, error.message);
        this.stats.errors++;
      }
    }
    
    console.log(`✓ Loaded ${this.stats.pricesLoaded} bond price records`);
  }

  /**
   * Load treasury rates
   */
  async loadTreasuryRates(): Promise<void> {
    console.log('\n[Treasury] Loading treasury rates...');
    
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 3);

      const data = await this.loader.rateLimiter.makeRequest('/treasury', {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      });

      if (!data || !Array.isArray(data)) {
        console.log('No treasury data available');
        return;
      }

      for (const rate of data) {
        try {
          await this.db.query(`
            INSERT INTO fmp.treasury_rates (
              date, month1, month3, month6,
              year1, year2, year5, year7,
              year10, year20, year30
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (date) DO UPDATE SET
              year10 = EXCLUDED.year10,
              year30 = EXCLUDED.year30
          `, [
            new Date(rate.date),
            rate.month1,
            rate.month3,
            rate.month6,
            rate.year1,
            rate.year2,
            rate.year5,
            rate.year7,
            rate.year10,
            rate.year20,
            rate.year30
          ]);
          
          this.stats.treasuryLoaded++;
        } catch (error: any) {
          console.error(`Error loading treasury rate for ${rate.date}:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.treasuryLoaded} treasury rate records`);
    } catch (error: any) {
      console.error('Error loading treasury rates:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load corporate bond ratings
   */
  async loadBondRatings(): Promise<void> {
    console.log('\n[Ratings] Loading bond ratings...');
    
    try {
      // Get companies with bonds
      const companies = await this.db.query(`
        SELECT DISTINCT symbol, market_cap FROM fmp.companies 
        WHERE market_cap > 1000000000 
        ORDER BY market_cap DESC 
        LIMIT 50
      `);

      for (const company of companies.rows) {
        try {
          const data = await this.loader.rateLimiter.makeRequest(
            `/rating/${company.symbol}`
          );

          if (data && Array.isArray(data) && data.length > 0) {
            const rating = data[0];
            
            // Store in company_ratings table
            await this.db.query(`
              INSERT INTO fmp.company_ratings (
                symbol, date, rating, rating_score,
                rating_recommendation,
                rating_details_dcf_score,
                rating_details_dcf_recommendation,
                rating_details_roe_score,
                rating_details_roe_recommendation,
                rating_details_pe_score,
                rating_details_pe_recommendation,
                rating_details_pb_score,
                rating_details_pb_recommendation,
                rating_details_de_score,
                rating_details_de_recommendation
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
              ON CONFLICT (symbol, date) DO UPDATE SET
                rating = EXCLUDED.rating,
                rating_score = EXCLUDED.rating_score,
                updated_at = CURRENT_TIMESTAMP
            `, [
              company.symbol,
              new Date(rating.date),
              rating.rating,
              rating.ratingScore,
              rating.ratingRecommendation,
              rating.ratingDetailsDCFScore,
              rating.ratingDetailsDCFRecommendation,
              rating.ratingDetailsROEScore,
              rating.ratingDetailsROERecommendation,
              rating.ratingDetailsPEScore,
              rating.ratingDetailsPERecommendation,
              rating.ratingDetailsPBScore,
              rating.ratingDetailsPBRecommendation,
              rating.ratingDetailsDEScore,
              rating.ratingDetailsDERecommendation
            ]);
            
            this.stats.ratingsLoaded++;
          }
          
          await this.sleep(50);
        } catch (error: any) {
          console.error(`Error loading rating for ${company.symbol}:`, error.message);
          this.stats.errors++;
        }
      }
      
      console.log(`✓ Loaded ${this.stats.ratingsLoaded} company ratings`);
    } catch (error: any) {
      console.error('Error loading bond ratings:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Load yield curve data
   */
  async loadYieldCurve(): Promise<void> {
    console.log('\n[Yield Curve] Loading yield curve data...');
    
    try {
      const data = await this.loader.rateLimiter.makeRequest('/treasury');
      
      if (data && Array.isArray(data) && data.length > 0) {
        const latest = data[0];
        console.log(`✓ Current 10Y Treasury Yield: ${latest.year10}%`);
        console.log(`✓ Current 2Y-10Y Spread: ${(latest.year10 - latest.year2).toFixed(3)}%`);
        
        // Check for yield curve inversion
        if (latest.year2 > latest.year10) {
          console.log('⚠️  YIELD CURVE INVERTED - Potential recession indicator');
        }
      }
    } catch (error: any) {
      console.error('Error loading yield curve:', error.message);
      this.stats.errors++;
    }
  }

  /**
   * Print summary statistics
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('BONDS DATA LOADER SUMMARY');
    console.log('='.repeat(60));
    console.log(`Bond Specifications Loaded: ${this.stats.bondsLoaded}`);
    console.log(`Bond Price Records Loaded: ${this.stats.pricesLoaded}`);
    console.log(`Treasury Rate Records Loaded: ${this.stats.treasuryLoaded}`);
    console.log(`Company Ratings Loaded: ${this.stats.ratingsLoaded}`);
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
      console.log('LOADING BONDS AND FIXED INCOME DATA');
      console.log('='.repeat(60));
      
      // Load all bond data
      await this.loadBondsList();
      await this.loadTreasuryRates();
      await this.loadYieldCurve();
      await this.loadBondRatings();
      // Skip bond prices for now as they may require different symbols
      // await this.loadBondPrices();
      
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
  const loader = new BondsDataLoader();
  loader.run().catch(console.error);
}

export { BondsDataLoader };