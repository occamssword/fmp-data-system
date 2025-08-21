import { config } from 'dotenv';
import { DatabaseClient } from '../src/database.js';
import { FMPDataLoader, FMPRateLimiter } from '../src/fmp-rate-limiter.js';
import axios from 'axios';

config();

/**
 * Comprehensive FMP timeseries data updater
 * Updates all financial, economic, and commodity timeseries data
 * Excludes: news, transcripts, press releases, social sentiment
 */

class ComprehensiveTimeseriesUpdater {
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

  constructor(yearsBack: number = 2) {
    this.db = new DatabaseClient();
    this.loader = new FMPDataLoader(this.db.pool);
    this.rateLimiter = new FMPRateLimiter();
    this.apiKey = process.env.FMP_API_KEY || '';
    
    // Set date range for specified years
    const today = new Date();
    const startDateObj = new Date();
    startDateObj.setFullYear(today.getFullYear() - yearsBack);
    
    this.endDate = today.toISOString().split('T')[0];
    this.startDate = startDateObj.toISOString().split('T')[0];
    
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Comprehensive FMP Timeseries Data Update`);
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
      
      // Focus on major stocks for the comprehensive update
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
   * Update financial ratios
   */
  async updateFinancialRatios(): Promise<void> {
    console.log('\n[Step 5] Updating financial ratios...');
    this.stats.tablesUpdated.push('financial_ratios');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/ratios/${symbol}`,
            { period: 'annual', limit: 10 }
          );
          
          if (data && data.length > 0) {
            for (const ratio of data) {
              await this.db.query(`
                INSERT INTO fmp.financial_ratios (
                  symbol, date, period,
                  current_ratio, quick_ratio, cash_ratio,
                  gross_profit_margin, operating_profit_margin, net_profit_margin,
                  return_on_assets, return_on_equity, return_on_capital_employed,
                  debt_ratio, debt_equity_ratio, interest_coverage,
                  dividend_yield, price_earnings_ratio, price_to_book_ratio,
                  price_to_sales_ratio, enterprise_value_multiple
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                ON CONFLICT (symbol, date, period) DO UPDATE SET
                  current_ratio = EXCLUDED.current_ratio,
                  price_earnings_ratio = EXCLUDED.price_earnings_ratio
              `, [
                symbol, ratio.date, ratio.period || 'FY',
                ratio.currentRatio, ratio.quickRatio, ratio.cashRatio,
                ratio.grossProfitMargin, ratio.operatingProfitMargin, ratio.netProfitMargin,
                ratio.returnOnAssets, ratio.returnOnEquity, ratio.returnOnCapitalEmployed,
                ratio.debtRatio, ratio.debtEquityRatio, ratio.interestCoverage,
                ratio.dividendYield, ratio.priceEarningsRatio, ratio.priceToBookRatio,
                ratio.priceToSalesRatio, ratio.enterpriseValueMultiple
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
    console.log(`✓ Financial ratios: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update financial growth metrics
   */
  async updateFinancialGrowth(): Promise<void> {
    console.log('\n[Step 6] Updating financial growth metrics...');
    this.stats.tablesUpdated.push('financial_growth');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/financial-growth/${symbol}`,
            { period: 'annual', limit: 10 }
          );
          
          if (data && data.length > 0) {
            for (const growth of data) {
              await this.db.query(`
                INSERT INTO fmp.financial_growth (
                  symbol, date, period,
                  revenue_growth, gross_profit_growth, ebitda_growth,
                  operating_income_growth, net_income_growth, eps_growth,
                  eps_diluted_growth, operating_cash_flow_growth, free_cash_flow_growth,
                  receivables_growth, inventory_growth, asset_growth,
                  book_value_per_share_growth, debt_growth
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                ON CONFLICT (symbol, date, period) DO UPDATE SET
                  revenue_growth = EXCLUDED.revenue_growth,
                  net_income_growth = EXCLUDED.net_income_growth
              `, [
                symbol, growth.date, growth.period || 'FY',
                growth.revenueGrowth, growth.grossProfitGrowth, growth.ebitdaGrowth,
                growth.operatingIncomeGrowth, growth.netIncomeGrowth, growth.epsgrowth,
                growth.epsdilutedGrowth, growth.operatingCashFlowGrowth, growth.freeCashFlowGrowth,
                growth.receivablesGrowth, growth.inventoryGrowth, growth.assetGrowth,
                growth.bookValuePerShareGrowth, growth.debtGrowth
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
    console.log(`✓ Financial growth: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update key metrics
   */
  async updateKeyMetrics(): Promise<void> {
    console.log('\n[Step 7] Updating key metrics...');
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
            for (const metric of data) {
              await this.db.query(`
                INSERT INTO fmp.key_metrics (
                  symbol, date, period, pe_ratio, price_to_sales_ratio, 
                  pb_ratio, debt_to_equity, current_ratio, return_on_equity,
                  return_on_assets, gross_profit_margin, operating_profit_margin,
                  net_profit_margin, dividend_yield, market_cap, enterprise_value,
                  revenue_per_share, net_income_per_share, operating_cash_flow_per_share,
                  free_cash_flow_per_share, cash_per_share, book_value_per_share
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
                ON CONFLICT (symbol, date, period) DO UPDATE SET
                  pe_ratio = EXCLUDED.pe_ratio,
                  market_cap = EXCLUDED.market_cap
              `, [
                symbol, metric.date, metric.period || 'FY',
                metric.peRatio, metric.priceToSalesRatio, metric.pbRatio,
                metric.debtToEquity, metric.currentRatio, metric.returnOnEquity,
                metric.returnOnAssets, metric.grossProfitMargin, metric.operatingProfitMargin,
                metric.netProfitMargin, metric.dividendYield, metric.marketCap,
                metric.enterpriseValue, metric.revenuePerShare, metric.netIncomePerShare,
                metric.operatingCashFlowPerShare, metric.freeCashFlowPerShare,
                metric.cashPerShare, metric.bookValuePerShare
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
   * Update enterprise values
   */
  async updateEnterpriseValues(): Promise<void> {
    console.log('\n[Step 8] Updating enterprise values...');
    this.stats.tablesUpdated.push('enterprise_values');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/enterprise-values/${symbol}`,
            { period: 'annual', limit: 10 }
          );
          
          if (data && data.length > 0) {
            for (const ev of data) {
              await this.db.query(`
                INSERT INTO fmp.enterprise_values (
                  symbol, date, stock_price, number_of_shares,
                  market_capitalization, minus_cash_and_cash_equivalents,
                  add_total_debt, enterprise_value
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  enterprise_value = EXCLUDED.enterprise_value
              `, [
                symbol, ev.date, ev.stockPrice, ev.numberOfShares,
                ev.marketCapitalization, ev.minusCashAndCashEquivalents,
                ev.addTotalDebt, ev.enterpriseValue
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
    console.log(`✓ Enterprise values: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update dividends history
   */
  async updateDividends(): Promise<void> {
    console.log('\n[Step 9] Updating dividend history...');
    this.stats.tablesUpdated.push('dividends');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/historical-price-full/stock_dividend/${symbol}`
          );
          
          if (data && data.historical && data.historical.length > 0) {
            for (const div of data.historical) {
              await this.db.query(`
                INSERT INTO fmp.dividends (
                  symbol, date, label, adj_dividend, dividend,
                  record_date, payment_date, declaration_date
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  dividend = EXCLUDED.dividend
              `, [
                symbol, div.date, div.label, div.adjDividend, div.dividend,
                div.recordDate, div.paymentDate, div.declarationDate
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
    console.log(`✓ Dividends: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update stock splits
   */
  async updateStockSplits(): Promise<void> {
    console.log('\n[Step 10] Updating stock splits...');
    this.stats.tablesUpdated.push('stock_splits');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < this.symbols.length; i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/historical-price-full/stock_split/${symbol}`
          );
          
          if (data && data.historical && data.historical.length > 0) {
            for (const split of data.historical) {
              await this.db.query(`
                INSERT INTO fmp.stock_splits (
                  symbol, date, label, numerator, denominator
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  numerator = EXCLUDED.numerator,
                  denominator = EXCLUDED.denominator
              `, [
                symbol, split.date, split.label, split.numerator, split.denominator
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
    console.log(`✓ Stock splits: ${successCount}/${this.symbols.length} updated`);
  }

  /**
   * Update earnings calendar and surprises
   */
  async updateEarnings(): Promise<void> {
    console.log('\n[Step 11] Updating earnings data...');
    this.stats.tablesUpdated.push('earnings_calendar', 'earnings_surprises');
    
    let calendarCount = 0;
    let surpriseCount = 0;
    
    // Get earnings calendar for date range
    try {
      const calendarData = await this.rateLimiter.makeRequest('/earning_calendar', {
        from: this.startDate,
        to: this.endDate
      });
      
      if (calendarData && Array.isArray(calendarData)) {
        for (const earning of calendarData.slice(0, 1000)) { // Limit to 1000 recent earnings
          try {
            await this.db.query(`
              INSERT INTO fmp.earnings_calendar (
                symbol, date, eps, eps_estimated, time, revenue, revenue_estimated,
                fiscal_date_ending, updated_from_date
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
              ON CONFLICT (symbol, date) DO UPDATE SET
                eps = EXCLUDED.eps,
                revenue = EXCLUDED.revenue
            `, [
              earning.symbol, earning.date, earning.eps, earning.epsEstimated,
              earning.time, earning.revenue, earning.revenueEstimated,
              earning.fiscalDateEnding, earning.updatedFromDate
            ]);
            calendarCount++;
          } catch (error) {
            // Continue on error
          }
        }
      }
      this.stats.totalRequests++;
    } catch (error) {
      console.error('Error fetching earnings calendar:', error);
    }
    
    // Get earnings surprises for each symbol
    const batchSize = 10;
    for (let i = 0; i < Math.min(this.symbols.length, 30); i += batchSize) {
      const batch = this.symbols.slice(i, i + batchSize);
      
      const promises = batch.map(async (symbol) => {
        try {
          const data = await this.rateLimiter.makeRequest(
            `/earnings-surprises/${symbol}`
          );
          
          if (data && Array.isArray(data)) {
            for (const surprise of data.slice(0, 10)) { // Last 10 earnings
              await this.db.query(`
                INSERT INTO fmp.earnings_surprises (
                  symbol, date, actual_earnings_per_share, estimated_earnings
                ) VALUES ($1, $2, $3, $4)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  actual_earnings_per_share = EXCLUDED.actual_earnings_per_share
              `, [
                symbol, surprise.date, surprise.actualEarningResult, surprise.estimatedEarning
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
      surpriseCount += results.filter(r => r).length;
      this.stats.totalRequests += batch.length;
      
      await this.sleep(1000);
    }
    
    this.stats.successfulUpdates += calendarCount > 0 ? 1 : 0;
    this.stats.successfulUpdates += surpriseCount;
    console.log(`✓ Earnings calendar: ${calendarCount} events added`);
    console.log(`✓ Earnings surprises: ${surpriseCount}/30 symbols updated`);
  }

  /**
   * Update analyst estimates
   */
  async updateAnalystEstimates(): Promise<void> {
    console.log('\n[Step 12] Updating analyst estimates...');
    this.stats.tablesUpdated.push('analyst_estimates');
    
    let successCount = 0;
    const batchSize = 5;
    
    for (let i = 0; i < Math.min(this.symbols.length, 30); i += batchSize) {
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
                  symbol, date, estimated_revenue_low, estimated_revenue_high,
                  estimated_revenue_avg, estimated_ebitda_low, estimated_ebitda_high,
                  estimated_ebitda_avg, estimated_net_income_low, estimated_net_income_high,
                  estimated_net_income_avg, estimated_eps_low, estimated_eps_high,
                  estimated_eps_avg, number_analyst_estimated_revenue, number_analysts_estimated_eps
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                ON CONFLICT (symbol, date) DO UPDATE SET
                  estimated_eps_avg = EXCLUDED.estimated_eps_avg
              `, [
                symbol, estimate.date, estimate.estimatedRevenueLow, estimate.estimatedRevenueHigh,
                estimate.estimatedRevenueAvg, estimate.estimatedEbitdaLow, estimate.estimatedEbitdaHigh,
                estimate.estimatedEbitdaAvg, estimate.estimatedNetIncomeLow, estimate.estimatedNetIncomeHigh,
                estimate.estimatedNetIncomeAvg, estimate.estimatedEpsLow, estimate.estimatedEpsHigh,
                estimate.estimatedEpsAvg, estimate.numberAnalystEstimatedRevenue, estimate.numberAnalystsEstimatedEps
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
    console.log(`✓ Analyst estimates: ${successCount}/30 updated`);
  }

  /**
   * Update economic calendar (2 years)
   */
  async updateEconomicCalendar(): Promise<void> {
    console.log('\n[Step 13] Updating economic calendar...');
    this.stats.tablesUpdated.push('economic_calendar');
    
    try {
      const data = await this.rateLimiter.makeRequest('/economic_calendar', {
        from: this.startDate,
        to: this.endDate
      });
      
      if (data && Array.isArray(data)) {
        let insertCount = 0;
        
        for (const event of data.slice(0, 1000)) { // Limit to recent 1000 events
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
   * Update treasury rates (2 years)
   */
  async updateTreasuryRates(): Promise<void> {
    console.log('\n[Step 14] Updating treasury rates...');
    this.stats.tablesUpdated.push('treasury_rates');
    
    try {
      const data = await this.rateLimiter.makeRequest('/treasury', {
        from: this.startDate,
        to: this.endDate
      });
      
      if (data && Array.isArray(data)) {
        let insertCount = 0;
        
        for (const rate of data) {
          try {
            await this.db.query(`
              INSERT INTO fmp.treasury_rates (
                date, month_1, month_2, month_3, month_6,
                year_1, year_2, year_3, year_5, year_7,
                year_10, year_20, year_30
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
              ON CONFLICT (date) DO UPDATE SET
                year_10 = EXCLUDED.year_10
            `, [
              rate.date, rate.month1, rate.month2, rate.month3, rate.month6,
              rate.year1, rate.year2, rate.year3, rate.year5, rate.year7,
              rate.year10, rate.year20, rate.year30
            ]);
            insertCount++;
          } catch (error) {
            // Continue on error
          }
        }
        
        this.stats.successfulUpdates++;
        this.stats.totalRequests++;
        console.log(`✓ Treasury rates: ${insertCount} days updated`);
      }
    } catch (error) {
      console.error('Error updating treasury rates:', error);
      this.stats.failedUpdates++;
    }
  }

  /**
   * Update market indexes
   */
  async updateMarketIndexes(): Promise<void> {
    console.log('\n[Step 15] Updating market indexes...');
    this.stats.tablesUpdated.push('market_indexes', 'index_prices');
    
    const indexes = ['^GSPC', '^DJI', '^IXIC', '^RUT', '^VIX', '^TNX', '^FTSE', '^N225'];
    let successCount = 0;
    
    for (const index of indexes) {
      try {
        // Get current quote
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
        }
        
        // Get historical data
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
          successCount++;
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
   * Update commodity prices
   */
  async updateCommodities(): Promise<void> {
    console.log('\n[Step 16] Updating commodity prices...');
    this.stats.tablesUpdated.push('commodity_quotes', 'commodity_prices');
    
    const commodities = [
      'GCUSD', 'SIUSD', 'CLUSD', 'NGUSD', 'KCUSD', 'SBUSD', 'CCUSD', 
      'CTUSD', 'ZSUSD', 'ZCUSD', 'WUSD', 'HGUSD', 'ALUSD'
    ];
    let successCount = 0;
    
    for (const commodity of commodities) {
      try {
        // Get current quote
        const quoteData = await this.rateLimiter.makeRequest(`/quote/${commodity}`);
        
        if (quoteData && quoteData.length > 0) {
          const quote = quoteData[0];
          await this.db.query(`
            INSERT INTO fmp.commodity_quotes (
              symbol, name, price, change_percentage, change,
              day_low, day_high, year_low, year_high, volume,
              open, previous_close
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (symbol) DO UPDATE SET
              price = EXCLUDED.price,
              change_percentage = EXCLUDED.change_percentage,
              updated_at = CURRENT_TIMESTAMP
          `, [
            quote.symbol, quote.name, quote.price, quote.changesPercentage,
            quote.change, quote.dayLow, quote.dayHigh, quote.yearLow,
            quote.yearHigh, quote.volume, quote.open, quote.previousClose
          ]);
        }
        
        // Get historical prices
        const historical = await this.rateLimiter.makeRequest(
          `/historical-price-full/${commodity}`,
          { from: this.startDate, to: this.endDate }
        );
        
        if (historical && historical.historical) {
          let recordCount = 0;
          for (const price of historical.historical) {
            await this.db.query(`
              INSERT INTO fmp.commodity_prices (
                symbol, date, open, high, low, close, volume
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol, date) DO UPDATE SET
                close = EXCLUDED.close
            `, [
              commodity, price.date, price.open, price.high,
              price.low, price.close, price.volume
            ]);
            recordCount++;
          }
          console.log(`  ${commodity}: ${recordCount} records`);
          successCount++;
        }
        
        this.stats.totalRequests += 2;
        await this.sleep(500);
      } catch (error) {
        console.error(`Error updating commodity ${commodity}:`, error);
      }
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Commodities: ${successCount}/${commodities.length} updated`);
  }

  /**
   * Update forex rates
   */
  async updateForexRates(): Promise<void> {
    console.log('\n[Step 17] Updating forex rates...');
    this.stats.tablesUpdated.push('forex_quotes', 'forex_prices');
    
    const forexPairs = [
      'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD',
      'NZDUSD', 'EURGBP', 'EURJPY', 'GBPJPY', 'USDCNY', 'USDINR'
    ];
    let successCount = 0;
    
    for (const pair of forexPairs) {
      try {
        // Get current quote
        const quoteData = await this.rateLimiter.makeRequest(`/quote/${pair}`);
        
        if (quoteData && quoteData.length > 0) {
          const quote = quoteData[0];
          await this.db.query(`
            INSERT INTO fmp.forex_quotes (
              ticker, bid, ask, open, low, high, changes, date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (ticker) DO UPDATE SET
              bid = EXCLUDED.bid,
              ask = EXCLUDED.ask,
              updated_at = CURRENT_TIMESTAMP
          `, [
            pair, quote.price, quote.price * 1.0001, // Approximate spread
            quote.open, quote.dayLow, quote.dayHigh,
            quote.change, new Date()
          ]);
        }
        
        // Get historical prices
        const historical = await this.rateLimiter.makeRequest(
          `/historical-price-full/${pair}`,
          { from: this.startDate, to: this.endDate }
        );
        
        if (historical && historical.historical) {
          let recordCount = 0;
          for (const price of historical.historical) {
            await this.db.query(`
              INSERT INTO fmp.forex_prices (
                ticker, date, open, high, low, close
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (ticker, date) DO UPDATE SET
                close = EXCLUDED.close
            `, [
              pair, price.date, price.open, price.high,
              price.low, price.close
            ]);
            recordCount++;
          }
          console.log(`  ${pair}: ${recordCount} records`);
          successCount++;
        }
        
        this.stats.totalRequests += 2;
        await this.sleep(500);
      } catch (error) {
        console.error(`Error updating forex ${pair}:`, error);
      }
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Forex pairs: ${successCount}/${forexPairs.length} updated`);
  }

  /**
   * Update crypto prices (limited selection)
   */
  async updateCryptoPrices(): Promise<void> {
    console.log('\n[Step 18] Updating cryptocurrency prices...');
    this.stats.tablesUpdated.push('crypto_quotes', 'crypto_prices');
    
    const cryptos = ['BTCUSD', 'ETHUSD', 'BNBUSD', 'XRPUSD', 'ADAUSD', 'DOGEUSD', 'SOLUSD', 'DOTUSD'];
    let successCount = 0;
    
    for (const crypto of cryptos) {
      try {
        // Get current quote
        const quoteData = await this.rateLimiter.makeRequest(`/quote/${crypto}`);
        
        if (quoteData && quoteData.length > 0) {
          const quote = quoteData[0];
          await this.db.query(`
            INSERT INTO fmp.crypto_quotes (
              symbol, name, price, change_percentage_24h, change_24h,
              market_cap, volume_24h
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (symbol) DO UPDATE SET
              price = EXCLUDED.price,
              change_percentage_24h = EXCLUDED.change_percentage_24h,
              updated_at = CURRENT_TIMESTAMP
          `, [
            crypto, quote.name, quote.price, quote.changesPercentage,
            quote.change, quote.marketCap, quote.volume
          ]);
        }
        
        // Get historical prices (last 6 months for crypto)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const historical = await this.rateLimiter.makeRequest(
          `/historical-price-full/${crypto}`,
          { from: sixMonthsAgo.toISOString().split('T')[0], to: this.endDate }
        );
        
        if (historical && historical.historical) {
          let recordCount = 0;
          for (const price of historical.historical) {
            await this.db.query(`
              INSERT INTO fmp.crypto_prices (
                symbol, date, open, high, low, close, volume
              ) VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (symbol, date) DO UPDATE SET
                close = EXCLUDED.close
            `, [
              crypto, price.date, price.open, price.high,
              price.low, price.close, price.volume
            ]);
            recordCount++;
          }
          console.log(`  ${crypto}: ${recordCount} records`);
          successCount++;
        }
        
        this.stats.totalRequests += 2;
        await this.sleep(500);
      } catch (error) {
        console.error(`Error updating crypto ${crypto}:`, error);
      }
    }
    
    this.stats.successfulUpdates += successCount;
    console.log(`✓ Cryptocurrencies: ${successCount}/${cryptos.length} updated`);
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
    console.log(`Tables Updated: ${this.stats.tablesUpdated.length}`);
    console.log(`  ${this.stats.tablesUpdated.join('\n  ')}`);
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
      await this.updateFinancialRatios();
      await this.updateFinancialGrowth();
      await this.updateKeyMetrics();
      await this.updateEnterpriseValues();
      await this.updateDividends();
      await this.updateStockSplits();
      await this.updateEarnings();
      await this.updateAnalystEstimates();
      await this.updateEconomicCalendar();
      await this.updateTreasuryRates();
      await this.updateMarketIndexes();
      await this.updateCommodities();
      await this.updateForexRates();
      await this.updateCryptoPrices();
      
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

// Parse command line arguments
const args = process.argv.slice(2);
const yearsBack = args[0] ? parseInt(args[0]) : 2; // Default 2 years

// Run the updater
const updater = new ComprehensiveTimeseriesUpdater(yearsBack);
console.log(`Updating ${yearsBack} years of data...`);
updater.run().catch(console.error);