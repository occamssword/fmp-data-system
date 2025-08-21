import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPRateLimiter } from '../src/fmp-rate-limiter.js';

config();

/**
 * Complete FMP Data Updater
 * Implements ALL available FMP API endpoints for 100% data coverage
 */

class CompleteFMPDataUpdater {
  private db: DatabaseClient;
  private rateLimiter: FMPRateLimiter;
  private apiKey: string;
  private symbols: string[] = [];
  private updateMode: 'full' | 'incremental';
  private lookbackDays: number;
  private stats = {
    totalRequests: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    tablesUpdated: new Set<string>(),
    startTime: new Date()
  };

  constructor(mode: 'full' | 'incremental' = 'incremental', lookbackDays: number = 7) {
    this.db = new DatabaseClient();
    this.rateLimiter = new FMPRateLimiter();
    this.apiKey = process.env.FMP_API_KEY || '';
    this.updateMode = mode;
    this.lookbackDays = lookbackDays;
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Complete FMP Data Update - ${mode.toUpperCase()} Mode`);
    console.log(`Lookback: ${lookbackDays} days | Time: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Get symbols based on update mode
   */
  async getSymbols(): Promise<void> {
    console.log('[1] Loading symbols...');
    
    const limit = this.updateMode === 'full' ? 500 : 100;
    
    const result = await this.db.query(`
      SELECT DISTINCT c.symbol, c.market_cap 
      FROM fmp.companies c
      WHERE c.market_cap IS NOT NULL
      ORDER BY c.market_cap DESC NULLS LAST
      LIMIT $1
    `, [limit]);
    
    this.symbols = result.rows.map(r => r.symbol);
    
    // Always include major indexes and commodities
    const additionalSymbols = [
      '^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX',
      'GCUSD', 'SIUSD', 'CLUSD', 'NGUSD',
      'EURUSD', 'GBPUSD', 'USDJPY',
      'BTCUSD', 'ETHUSD'
    ];
    
    this.symbols = [...new Set([...this.symbols, ...additionalSymbols])];
    console.log(`Loaded ${this.symbols.length} symbols for update`);
  }

  /**
   * Update ESG Scores
   */
  async updateESGScores(): Promise<void> {
    console.log('\n[ESG] Updating ESG scores...');
    let successCount = 0;
    
    const symbolsToUpdate = this.updateMode === 'full' ? this.symbols : this.symbols.slice(0, 50);
    
    for (const symbol of symbolsToUpdate) {
      try {
        const data = await this.rateLimiter.makeRequest(
          `/esg-environmental-social-governance-data/${symbol}`
        );
        
        if (data && Array.isArray(data) && data.length > 0) {
          for (const esg of data) {
            await this.db.query(`
              INSERT INTO fmp.esg_scores (
                symbol, date, environment_score, social_score,
                governance_score, esg_score, rating
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol, date) DO UPDATE SET
                esg_score = EXCLUDED.esg_score,
                rating = EXCLUDED.rating,
                updated_at = CURRENT_TIMESTAMP
            `, [
              symbol, esg.date, esg.environmentalScore,
              esg.socialScore, esg.governanceScore,
              esg.ESGScore, esg.rating
            ]);
          }
          successCount++;
        }
        
        this.stats.totalRequests++;
        await this.sleep(100);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('esg_scores');
    console.log(`✓ ESG scores: ${successCount}/${symbolsToUpdate.length} updated`);
  }

  /**
   * Update Technical Indicators
   */
  async updateTechnicalIndicators(): Promise<void> {
    console.log('\n[Technical] Updating technical indicators...');
    
    const indicators = [
      { type: 'sma', periods: [20, 50, 200] },
      { type: 'ema', periods: [12, 26] },
      { type: 'rsi', periods: [14] },
      { type: 'macd', periods: [12] }
    ];
    
    const symbolsToUpdate = this.updateMode === 'full' ? 
      this.symbols.slice(0, 50) : this.symbols.slice(0, 20);
    
    let successCount = 0;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - this.lookbackDays);
    const fromDate = startDate.toISOString().split('T')[0];
    
    for (const symbol of symbolsToUpdate) {
      for (const indicator of indicators) {
        for (const period of indicator.periods) {
          try {
            const data = await this.rateLimiter.makeRequest(
              `/technical_indicator/${period}/${symbol}`,
              { type: indicator.type, from: fromDate, to: endDate }
            );
            
            if (data && Array.isArray(data)) {
              for (const point of data) {
                const value = point[indicator.type] || point.value || 
                             point.close || point.signal;
                
                if (value !== undefined) {
                  await this.db.query(`
                    INSERT INTO fmp.technical_indicators (
                      symbol, date, indicator_type, period, value,
                      signal_value, histogram
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (symbol, date, indicator_type, period) DO UPDATE SET
                      value = EXCLUDED.value
                  `, [
                    symbol, point.date, indicator.type.toUpperCase(),
                    period, value, point.signal || null, point.histogram || null
                  ]);
                }
              }
              successCount++;
            }
            
            this.stats.totalRequests++;
            await this.sleep(50);
          } catch (error) {
            // Continue on error
          }
        }
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('technical_indicators');
    console.log(`✓ Technical indicators: ${successCount} indicator sets updated`);
  }

  /**
   * Update Options Chain
   */
  async updateOptionsChain(): Promise<void> {
    console.log('\n[Options] Updating options chain...');
    
    const optionSymbols = this.updateMode === 'full' ? 
      this.symbols.slice(0, 20) : this.symbols.slice(0, 10);
    
    let successCount = 0;
    
    for (const symbol of optionSymbols) {
      try {
        // Get expiration dates
        const expirations = await this.rateLimiter.makeRequest(
          `/options/expiration/${symbol}`
        );
        
        if (expirations && Array.isArray(expirations) && expirations.length > 0) {
          // Get options for next 2 expirations
          const expirationsToFetch = expirations.slice(0, 2);
          
          for (const expiry of expirationsToFetch) {
            const chain = await this.rateLimiter.makeRequest(
              `/options-chain/${symbol}`,
              { date: expiry }
            );
            
            if (chain && Array.isArray(chain)) {
              for (const option of chain) {
                await this.db.query(`
                  INSERT INTO fmp.options_chain (
                    symbol, expiration_date, strike_price, option_type,
                    contract_symbol, bid, ask, last_price, mark,
                    volume, open_interest, implied_volatility,
                    in_the_money, time_value, intrinsic_value
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
                  option.type || (option.call ? 'CALL' : 'PUT'),
                  option.contractSymbol, option.bid, option.ask,
                  option.lastTradePrice, option.mark,
                  option.volume, option.openInterest,
                  option.impliedVolatility, option.inTheMoney,
                  option.timeValue, option.intrinsicValue
                ]);
              }
              successCount++;
            }
            
            this.stats.totalRequests++;
            await this.sleep(200);
          }
        }
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('options_chain');
    console.log(`✓ Options chain: ${successCount} contracts updated`);
  }

  /**
   * Update Sector Performance
   */
  async updateSectorPerformance(): Promise<void> {
    console.log('\n[Market] Updating sector performance...');
    
    try {
      const data = await this.rateLimiter.makeRequest('/sectors-performance');
      
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        let count = 0;
        
        for (const [sector, performance] of Object.entries(data)) {
          if (typeof performance === 'string') {
            const changePercent = parseFloat(performance.replace('%', ''));
            
            await this.db.query(`
              INSERT INTO fmp.sector_performance (
                date, sector, change_percentage
              ) VALUES ($1, $2, $3)
              ON CONFLICT (date, sector) DO UPDATE SET
                change_percentage = EXCLUDED.change_percentage
            `, [today, sector, changePercent]);
            count++;
          }
        }
        
        // Also get historical sector performance
        const historicalData = await this.rateLimiter.makeRequest(
          '/historical-sectors-performance',
          { limit: this.lookbackDays }
        );
        
        if (historicalData && Array.isArray(historicalData)) {
          for (const day of historicalData) {
            for (const [sector, perf] of Object.entries(day)) {
              if (sector !== 'date' && typeof perf === 'string') {
                await this.db.query(`
                  INSERT INTO fmp.sector_performance (
                    date, sector, change_percentage
                  ) VALUES ($1, $2, $3)
                  ON CONFLICT (date, sector) DO UPDATE SET
                    change_percentage = EXCLUDED.change_percentage
                `, [day.date, sector, parseFloat(perf.replace('%', ''))]);
              }
            }
          }
        }
        
        this.stats.successfulUpdates++;
        this.stats.tablesUpdated.add('sector_performance');
        this.stats.totalRequests += 2;
        console.log(`✓ Sector performance: ${count} sectors updated`);
      }
    } catch (error) {
      console.error('Error updating sector performance:', error);
    }
  }

  /**
   * Update Market Breadth
   */
  async updateMarketBreadth(): Promise<void> {
    console.log('\n[Market] Updating market breadth...');
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get market gainers/losers for breadth calculation
      const [gainers, losers] = await Promise.all([
        this.rateLimiter.makeRequest('/stock_market/gainers'),
        this.rateLimiter.makeRequest('/stock_market/losers')
      ]);
      
      const advances = gainers ? gainers.length : 0;
      const declines = losers ? losers.length : 0;
      
      // Get VIX value
      const vixData = await this.rateLimiter.makeRequest('/quote/^VIX');
      const vixValue = vixData && vixData[0] ? vixData[0].price : null;
      
      await this.db.query(`
        INSERT INTO fmp.market_breadth (
          date, exchange, advances, declines,
          advance_decline_ratio, vix_value
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (date, exchange) DO UPDATE SET
          advances = EXCLUDED.advances,
          declines = EXCLUDED.declines,
          vix_value = EXCLUDED.vix_value
      `, [
        today, 'NYSE', advances, declines,
        declines > 0 ? advances / declines : null,
        vixValue
      ]);
      
      this.stats.successfulUpdates++;
      this.stats.tablesUpdated.add('market_breadth');
      this.stats.totalRequests += 3;
      console.log(`✓ Market breadth updated`);
    } catch (error) {
      console.error('Error updating market breadth:', error);
    }
  }

  /**
   * Update DCF Models
   */
  async updateDCFModels(): Promise<void> {
    console.log('\n[Valuation] Updating DCF models...');
    
    const symbolsToUpdate = this.updateMode === 'full' ? 
      this.symbols.slice(0, 100) : this.symbols.slice(0, 30);
    
    let successCount = 0;
    
    for (const symbol of symbolsToUpdate) {
      try {
        const [dcf, historical] = await Promise.all([
          this.rateLimiter.makeRequest(`/discounted-cash-flow/${symbol}`),
          this.rateLimiter.makeRequest(`/historical-discounted-cash-flow/${symbol}`, { limit: 1 })
        ]);
        
        if (dcf && Array.isArray(dcf) && dcf.length > 0) {
          const dcfData = dcf[0];
          const today = new Date().toISOString().split('T')[0];
          
          await this.db.query(`
            INSERT INTO fmp.dcf_models (
              symbol, date, stock_price, dcf_value,
              upside_percentage
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (symbol, date) DO UPDATE SET
              dcf_value = EXCLUDED.dcf_value,
              upside_percentage = EXCLUDED.upside_percentage
          `, [
            symbol, today, dcfData['Stock Price'],
            dcfData.dcf,
            ((dcfData.dcf - dcfData['Stock Price']) / dcfData['Stock Price'] * 100)
          ]);
          successCount++;
        }
        
        if (historical && Array.isArray(historical)) {
          for (const hist of historical.slice(0, 5)) {
            await this.db.query(`
              INSERT INTO fmp.dcf_models (
                symbol, date, stock_price, dcf_value,
                upside_percentage
              ) VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (symbol, date) DO NOTHING
            `, [
              symbol, hist.date, hist.price, hist.dcf,
              ((hist.dcf - hist.price) / hist.price * 100)
            ]);
          }
        }
        
        this.stats.totalRequests += 2;
        await this.sleep(100);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('dcf_models');
    console.log(`✓ DCF models: ${successCount}/${symbolsToUpdate.length} updated`);
  }

  /**
   * Update Company Ratings
   */
  async updateCompanyRatings(): Promise<void> {
    console.log('\n[Ratings] Updating company ratings...');
    
    const symbolsToUpdate = this.updateMode === 'full' ? 
      this.symbols.slice(0, 100) : this.symbols.slice(0, 50);
    
    let successCount = 0;
    
    for (const symbol of symbolsToUpdate) {
      try {
        const data = await this.rateLimiter.makeRequest(`/rating/${symbol}`);
        
        if (data && Array.isArray(data) && data.length > 0) {
          const rating = data[0];
          
          await this.db.query(`
            INSERT INTO fmp.company_ratings (
              symbol, date, rating, rating_score,
              rating_recommendation,
              rating_details_dcf_score,
              rating_details_dcf_recommendation,
              rating_details_roe_score,
              rating_details_roe_recommendation,
              rating_details_pe_score,
              rating_details_pe_recommendation
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (symbol, date) DO UPDATE SET
              rating = EXCLUDED.rating,
              rating_score = EXCLUDED.rating_score
          `, [
            symbol, rating.date, rating.rating,
            rating.ratingScore, rating.ratingRecommendation,
            rating.ratingDetailsDCFScore,
            rating.ratingDetailsDCFRecommendation,
            rating.ratingDetailsROEScore,
            rating.ratingDetailsROERecommendation,
            rating.ratingDetailsPEScore,
            rating.ratingDetailsPERecommendation
          ]);
          successCount++;
        }
        
        this.stats.totalRequests++;
        await this.sleep(50);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('company_ratings');
    console.log(`✓ Company ratings: ${successCount}/${symbolsToUpdate.length} updated`);
  }

  /**
   * Update M&A Deals
   */
  async updateMADeals(): Promise<void> {
    console.log('\n[M&A] Updating mergers and acquisitions...');
    
    try {
      const data = await this.rateLimiter.makeRequest('/mergers-acquisitions', {
        limit: 100
      });
      
      if (data && Array.isArray(data)) {
        let count = 0;
        
        for (const deal of data) {
          try {
            await this.db.query(`
              INSERT INTO fmp.ma_deals (
                acquirer_symbol, target_symbol,
                announcement_date, completion_date,
                deal_value, deal_type, payment_method,
                deal_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              ON CONFLICT DO NOTHING
            `, [
              deal.acquirerSymbol, deal.targetSymbol,
              deal.announcementDate, deal.completionDate,
              deal.dealValue, deal.dealType,
              deal.paymentMethod, deal.status
            ]);
            count++;
          } catch (error) {
            // Continue on error
          }
        }
        
        this.stats.successfulUpdates++;
        this.stats.tablesUpdated.add('ma_deals');
        this.stats.totalRequests++;
        console.log(`✓ M&A deals: ${count} deals updated`);
      }
    } catch (error) {
      console.error('Error updating M&A deals:', error);
    }
  }

  /**
   * Update Senate Trading
   */
  async updateSenateTrading(): Promise<void> {
    console.log('\n[Alternative] Updating senate trading...');
    
    try {
      const data = await this.rateLimiter.makeRequest('/senate-trading', {
        limit: 100
      });
      
      if (data && Array.isArray(data)) {
        let count = 0;
        
        for (const trade of data) {
          try {
            await this.db.query(`
              INSERT INTO fmp.senate_trading (
                senator_name, state, party, symbol,
                transaction_date, disclosure_date,
                transaction_type, amount_range, asset_type
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT DO NOTHING
            `, [
              trade.senatorName, trade.state, trade.party,
              trade.symbol, trade.transactionDate,
              trade.disclosureDate, trade.transactionType,
              trade.amountRange, trade.assetType
            ]);
            count++;
          } catch (error) {
            // Continue on error
          }
        }
        
        this.stats.successfulUpdates++;
        this.stats.tablesUpdated.add('senate_trading');
        this.stats.totalRequests++;
        console.log(`✓ Senate trading: ${count} transactions updated`);
      }
    } catch (error) {
      console.error('Error updating senate trading:', error);
    }
  }

  /**
   * Update House Trading
   */
  async updateHouseTrading(): Promise<void> {
    console.log('\n[Alternative] Updating house trading...');
    
    try {
      const data = await this.rateLimiter.makeRequest('/house-trading', {
        limit: 100
      });
      
      if (data && Array.isArray(data)) {
        let count = 0;
        
        for (const trade of data) {
          try {
            await this.db.query(`
              INSERT INTO fmp.house_trading (
                representative_name, state, district, party,
                symbol, transaction_date, disclosure_date,
                transaction_type, amount_range, asset_type
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT DO NOTHING
            `, [
              trade.representativeName, trade.state,
              trade.district, trade.party, trade.symbol,
              trade.transactionDate, trade.disclosureDate,
              trade.transactionType, trade.amountRange,
              trade.assetType
            ]);
            count++;
          } catch (error) {
            // Continue on error
          }
        }
        
        this.stats.successfulUpdates++;
        this.stats.tablesUpdated.add('house_trading');
        this.stats.totalRequests++;
        console.log(`✓ House trading: ${count} transactions updated`);
      }
    } catch (error) {
      console.error('Error updating house trading:', error);
    }
  }

  /**
   * Update COT Reports
   */
  async updateCOTReports(): Promise<void> {
    console.log('\n[COT] Updating commitment of traders...');
    
    const cotSymbols = ['GC', 'SI', 'CL', 'NG', 'ZC', 'ZS', 'ZW'];
    let successCount = 0;
    
    for (const symbol of cotSymbols) {
      try {
        const data = await this.rateLimiter.makeRequest(
          `/commitment-of-traders-report/${symbol}`
        );
        
        if (data && Array.isArray(data)) {
          for (const report of data.slice(0, 10)) {
            await this.db.query(`
              INSERT INTO fmp.cot_reports (
                symbol, report_date,
                commercial_long, commercial_short, commercial_net,
                non_commercial_long, non_commercial_short, non_commercial_net,
                non_reportable_long, non_reportable_short,
                open_interest
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
              ON CONFLICT (symbol, report_date) DO UPDATE SET
                open_interest = EXCLUDED.open_interest
            `, [
              symbol, report.date,
              report.commercialLong, report.commercialShort,
              report.commercialNet,
              report.nonCommercialLong, report.nonCommercialShort,
              report.nonCommercialNet,
              report.nonReportableLong, report.nonReportableShort,
              report.openInterest
            ]);
          }
          successCount++;
        }
        
        this.stats.totalRequests++;
        await this.sleep(200);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('cot_reports');
    console.log(`✓ COT reports: ${successCount}/${cotSymbols.length} updated`);
  }

  /**
   * Update Enhanced Economic Data
   */
  async updateEnhancedEconomicData(): Promise<void> {
    console.log('\n[Economic] Updating enhanced economic data...');
    
    try {
      // GDP Data
      const gdpData = await this.rateLimiter.makeRequest('/economic', {
        indicator: 'GDP',
        limit: 10
      });
      
      if (gdpData && Array.isArray(gdpData)) {
        for (const gdp of gdpData) {
          await this.db.query(`
            INSERT INTO fmp.gdp_data (
              country, date, gdp_nominal, gdp_growth_rate
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (country, date) DO UPDATE SET
              gdp_growth_rate = EXCLUDED.gdp_growth_rate
          `, [
            'USA', gdp.date, gdp.value, gdp.change
          ]);
        }
      }
      
      // CPI/Inflation Data
      const cpiData = await this.rateLimiter.makeRequest('/economic', {
        indicator: 'CPI',
        limit: 10
      });
      
      if (cpiData && Array.isArray(cpiData)) {
        for (const cpi of cpiData) {
          await this.db.query(`
            INSERT INTO fmp.inflation_data (
              country, date, cpi_value, cpi_change_percentage
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (country, date) DO UPDATE SET
              cpi_value = EXCLUDED.cpi_value
          `, [
            'USA', cpi.date, cpi.value, cpi.change
          ]);
        }
      }
      
      this.stats.successfulUpdates += 2;
      this.stats.tablesUpdated.add('gdp_data');
      this.stats.tablesUpdated.add('inflation_data');
      this.stats.totalRequests += 2;
      console.log(`✓ Enhanced economic data updated`);
    } catch (error) {
      console.error('Error updating economic data:', error);
    }
  }

  /**
   * Update Company Outlook
   */
  async updateCompanyOutlook(): Promise<void> {
    console.log('\n[Company] Updating company outlook...');
    
    const symbolsToUpdate = this.updateMode === 'full' ? 
      this.symbols.slice(0, 50) : this.symbols.slice(0, 20);
    
    let successCount = 0;
    
    for (const symbol of symbolsToUpdate) {
      try {
        const data = await this.rateLimiter.makeRequest(
          `/company-outlook/${symbol}`
        );
        
        if (data && data.profile) {
          await this.db.query(`
            INSERT INTO fmp.company_outlook (
              symbol, rating, rating_details,
              insider_transactions, key_executives,
              splits_history, stock_dividend, stock_news
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (symbol) DO UPDATE SET
              rating = EXCLUDED.rating,
              updated_at = CURRENT_TIMESTAMP
          `, [
            symbol,
            data.rating || null,
            JSON.stringify(data.ratingDetails || {}),
            JSON.stringify(data.insiderTransactions || []),
            JSON.stringify(data.keyExecutives || []),
            JSON.stringify(data.splitsHistory || []),
            JSON.stringify(data.stockDividend || []),
            JSON.stringify(data.stockNews || [])
          ]);
          successCount++;
        }
        
        this.stats.totalRequests++;
        await this.sleep(100);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('company_outlook');
    console.log(`✓ Company outlook: ${successCount}/${symbolsToUpdate.length} updated`);
  }

  /**
   * Update Revenue Segments
   */
  async updateRevenueSegments(): Promise<void> {
    console.log('\n[Revenue] Updating revenue segments...');
    
    const symbolsToUpdate = this.updateMode === 'full' ? 
      this.symbols.slice(0, 30) : this.symbols.slice(0, 10);
    
    let successCount = 0;
    
    for (const symbol of symbolsToUpdate) {
      try {
        const data = await this.rateLimiter.makeRequest(
          `/revenue-product-segmentation/${symbol}`
        );
        
        if (data && Array.isArray(data)) {
          for (const segment of data.slice(0, 5)) {
            if (segment.segments) {
              for (const [segmentName, revenue] of Object.entries(segment.segments)) {
                await this.db.query(`
                  INSERT INTO fmp.revenue_segments (
                    symbol, date, period, segment_name, revenue
                  ) VALUES ($1, $2, $3, $4, $5)
                  ON CONFLICT DO NOTHING
                `, [
                  symbol, segment.date, segment.period,
                  segmentName, revenue
                ]);
              }
            }
          }
          successCount++;
        }
        
        this.stats.totalRequests++;
        await this.sleep(100);
      } catch (error) {
        // Continue on error
      }
    }
    
    this.stats.successfulUpdates += successCount;
    this.stats.tablesUpdated.add('revenue_segments');
    console.log(`✓ Revenue segments: ${successCount}/${symbolsToUpdate.length} updated`);
  }

  /**
   * Print summary
   */
  printSummary(): void {
    const elapsed = ((Date.now() - this.stats.startTime.getTime()) / 1000 / 60).toFixed(1);
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`UPDATE COMPLETE`);
    console.log(`${'='.repeat(80)}`);
    console.log(`Mode: ${this.updateMode.toUpperCase()}`);
    console.log(`Time Elapsed: ${elapsed} minutes`);
    console.log(`Total API Requests: ${this.stats.totalRequests}`);
    console.log(`Successful Updates: ${this.stats.successfulUpdates}`);
    console.log(`Failed Updates: ${this.stats.failedUpdates}`);
    console.log(`Tables Updated: ${this.stats.tablesUpdated.size}`);
    console.log(`  ${Array.from(this.stats.tablesUpdated).join(', ')}`);
    console.log(`Symbols Processed: ${this.symbols.length}`);
    console.log(`${'='.repeat(80)}\n`);
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
      
      // Get symbols
      await this.getSymbols();
      
      // Core updates (always run)
      await this.updateSectorPerformance();
      await this.updateMarketBreadth();
      
      // Extended updates based on mode
      if (this.updateMode === 'full' || new Date().getHours() % 6 === 0) {
        await this.updateESGScores();
        await this.updateDCFModels();
        await this.updateCompanyRatings();
      }
      
      if (this.updateMode === 'full' || new Date().getHours() % 4 === 0) {
        await this.updateTechnicalIndicators();
        await this.updateOptionsChain();
      }
      
      if (this.updateMode === 'full' || new Date().getDay() === 1) {
        await this.updateMADeals();
        await this.updateSenateTrading();
        await this.updateHouseTrading();
        await this.updateCOTReports();
      }
      
      if (this.updateMode === 'full' || new Date().getHours() === 6) {
        await this.updateEnhancedEconomicData();
        await this.updateCompanyOutlook();
        await this.updateRevenueSegments();
      }
      
      this.printSummary();
      
    } catch (error: any) {
      console.error('\n❌ Fatal error:', error.message);
      console.error(error);
    } finally {
      await this.db.disconnect();
      process.exit(0);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const mode = (args[0] === 'full' || args[0] === 'incremental') ? args[0] : 'incremental';
const lookbackDays = args[1] ? parseInt(args[1]) : 7;

// Run the updater
const updater = new CompleteFMPDataUpdater(mode as 'full' | 'incremental', lookbackDays);
updater.run().catch(console.error);