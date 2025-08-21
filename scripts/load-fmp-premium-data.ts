import axios from 'axios';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// FMP API configuration
const FMP_API_KEY = process.env.FMP_API_KEY || 'afxb7fQ1Fv0cMF0T06gkBkWpqQQiWLEl';
const FMP_BASE_URL = 'https://financialmodelingprep.com/api/v3';

// PostgreSQL connection pool
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'economic_data',
  user: 'parthbhatt',
  password: ''
});

// Generic API fetch function with rate limiting
async function fetchFromFMP(endpoint: string, params: any = {}) {
  try {
    const url = `${FMP_BASE_URL}${endpoint}`;
    console.log(`Fetching: ${endpoint}`);
    
    const response = await axios.get(url, {
      params: {
        ...params,
        apikey: FMP_API_KEY
      }
    });
    
    // Rate limit: 50ms delay between requests
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching ${endpoint}:`, error.message);
    if (error.response?.status === 403) {
      console.error('⚠️  403 Forbidden - This endpoint may require premium access');
    }
    return null;
  }
}

// Load Income Statements
async function loadIncomeStatements() {
  console.log('\n💰 Loading Income Statements...');
  
  // Test with a few major companies
  const symbols = ['AAPL', 'MSFT', 'GOOGL'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    // Try annual statements
    const annualData = await fetchFromFMP(`/income-statement/${symbol}?period=annual&limit=5`);
    if (!annualData || annualData.length === 0) {
      console.log(`No annual income statement data for ${symbol}`);
      continue;
    }
    
    for (const item of annualData) {
      try {
        await pool.query(`
          INSERT INTO fmp.income_statements (
            symbol, date, period, revenue, cost_of_revenue, gross_profit, gross_profit_ratio,
            research_and_development_expenses, general_and_administrative_expenses,
            selling_and_marketing_expenses, operating_expenses, cost_and_expenses,
            interest_expense, depreciation_and_amortization, ebitda, ebitda_ratio,
            operating_income, operating_income_ratio, total_other_income_expenses_net,
            income_before_tax, income_before_tax_ratio, income_tax_expense,
            net_income, net_income_ratio, eps, eps_diluted,
            weighted_average_shares_outstanding, weighted_average_shares_outstanding_diluted
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
          ON CONFLICT (symbol, date, period) DO UPDATE SET
            revenue = EXCLUDED.revenue,
            net_income = EXCLUDED.net_income,
            eps = EXCLUDED.eps
        `, [
          item.symbol, item.date, item.period, item.revenue, item.costOfRevenue,
          item.grossProfit, item.grossProfitRatio, item.researchAndDevelopmentExpenses,
          item.generalAndAdministrativeExpenses, item.sellingAndMarketingExpenses,
          item.sellingGeneralAndAdministrativeExpenses, item.costAndExpenses,
          item.interestExpense, item.depreciationAndAmortization, item.ebitda,
          item.ebitdaratio, item.operatingIncome, item.operatingIncomeRatio,
          item.totalOtherIncomeExpensesNet, item.incomeBeforeTax,
          item.incomeBeforeTaxRatio, item.incomeTaxExpense, item.netIncome,
          item.netIncomeRatio, item.eps, item.epsdiluted,
          item.weightedAverageShsOut, item.weightedAverageShsOutDil
        ]);
        totalCount++;
      } catch (error) {
        console.error(`Error inserting income statement for ${symbol}:`, error);
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} income statement entries`);
  return totalCount;
}

// Load Balance Sheets
async function loadBalanceSheets() {
  console.log('\n📊 Loading Balance Sheets...');
  
  const symbols = ['AAPL', 'MSFT', 'GOOGL'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const annualData = await fetchFromFMP(`/balance-sheet-statement/${symbol}?period=annual&limit=5`);
    if (!annualData || annualData.length === 0) {
      console.log(`No balance sheet data for ${symbol}`);
      continue;
    }
    
    for (const item of annualData) {
      try {
        await pool.query(`
          INSERT INTO fmp.balance_sheets (
            symbol, date, period, cash_and_cash_equivalents, short_term_investments,
            cash_and_short_term_investments, net_receivables, inventory,
            other_current_assets, total_current_assets, property_plant_equipment_net,
            goodwill, intangible_assets, long_term_investments, tax_assets,
            other_non_current_assets, total_non_current_assets, total_assets,
            accounts_payables, short_term_debt, tax_payables, deferred_revenue,
            other_current_liabilities, total_current_liabilities, long_term_debt,
            deferred_revenue_non_current, deferred_tax_liabilities_non_current,
            other_non_current_liabilities, total_non_current_liabilities,
            total_liabilities, common_stock, retained_earnings,
            accumulated_other_comprehensive_income_loss, total_stockholders_equity,
            total_liabilities_and_stockholders_equity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
          ON CONFLICT (symbol, date, period) DO UPDATE SET
            total_assets = EXCLUDED.total_assets,
            total_liabilities = EXCLUDED.total_liabilities
        `, [
          item.symbol, item.date, item.period, item.cashAndCashEquivalents,
          item.shortTermInvestments, item.cashAndShortTermInvestments,
          item.netReceivables, item.inventory, item.otherCurrentAssets,
          item.totalCurrentAssets, item.propertyPlantEquipmentNet, item.goodwill,
          item.intangibleAssets, item.longTermInvestments, item.taxAssets,
          item.otherNonCurrentAssets, item.totalNonCurrentAssets, item.totalAssets,
          item.accountPayables, item.shortTermDebt, item.taxPayables,
          item.deferredRevenue, item.otherCurrentLiabilities,
          item.totalCurrentLiabilities, item.longTermDebt,
          item.deferredRevenueNonCurrent, item.deferredTaxLiabilitiesNonCurrent,
          item.otherNonCurrentLiabilities, item.totalNonCurrentLiabilities,
          item.totalLiabilities, item.commonStock, item.retainedEarnings,
          item.accumulatedOtherComprehensiveIncomeLoss,
          item.totalStockholdersEquity, item.totalLiabilitiesAndStockholdersEquity
        ]);
        totalCount++;
      } catch (error) {
        console.error(`Error inserting balance sheet for ${symbol}:`, error);
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} balance sheet entries`);
  return totalCount;
}

// Load Real-Time Quotes
async function loadRealTimeQuotes() {
  console.log('\n📈 Loading Real-Time Quotes...');
  
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const quote = await fetchFromFMP(`/quote/${symbol}`);
    if (!quote || quote.length === 0) {
      console.log(`No real-time quote for ${symbol}`);
      continue;
    }
    
    const item = quote[0];
    try {
      await pool.query(`
        INSERT INTO fmp.real_time_quotes (
          symbol, price, change_percentage, change, day_low, day_high,
          year_high, year_low, market_cap, price_avg_50, price_avg_200,
          volume, avg_volume, exchange, open, previous_close, eps, pe,
          earnings_announcement, shares_outstanding, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (symbol) DO UPDATE SET
          price = EXCLUDED.price,
          change = EXCLUDED.change,
          volume = EXCLUDED.volume,
          updated_at = CURRENT_TIMESTAMP
      `, [
        item.symbol, item.price, item.changesPercentage, item.change,
        item.dayLow, item.dayHigh, item.yearHigh, item.yearLow,
        item.marketCap, item.priceAvg50, item.priceAvg200, item.volume,
        item.avgVolume, item.exchange, item.open, item.previousClose,
        item.eps, item.pe, item.earningsAnnouncement, item.sharesOutstanding,
        item.timestamp
      ]);
      totalCount++;
    } catch (error) {
      console.error(`Error inserting quote for ${symbol}:`, error);
    }
  }
  console.log(`✅ Loaded ${totalCount} real-time quotes`);
  return totalCount;
}

// Load Historical Stock Prices
async function loadHistoricalPrices() {
  console.log('\n📉 Loading Historical Stock Prices...');
  
  // Load 1 month of data for a few stocks
  const symbols = ['AAPL', 'MSFT'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const prices = await fetchFromFMP(`/historical-price-full/${symbol}?from=2024-07-01&to=2024-08-01`);
    if (!prices || !prices.historical) {
      console.log(`No historical prices for ${symbol}`);
      continue;
    }
    
    for (const item of prices.historical) {
      try {
        await pool.query(`
          INSERT INTO fmp.stock_prices (
            symbol, date, open, high, low, close, adj_close, volume,
            unadjusted_volume, change, change_percent, vwap
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (symbol, date) DO UPDATE SET
            close = EXCLUDED.close,
            volume = EXCLUDED.volume
        `, [
          symbol, item.date, item.open, item.high, item.low, item.close,
          item.adjClose, item.volume, item.unadjustedVolume, item.change,
          item.changePercent, item.vwap
        ]);
        totalCount++;
      } catch (error) {
        console.error(`Error inserting price for ${symbol}:`, error);
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} historical price entries`);
  return totalCount;
}

// Load Analyst Estimates
async function loadAnalystEstimates() {
  console.log('\n🎯 Loading Analyst Estimates...');
  
  const symbols = ['AAPL', 'MSFT', 'GOOGL'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const estimates = await fetchFromFMP(`/analyst-estimates/${symbol}?limit=4`);
    if (!estimates || estimates.length === 0) {
      console.log(`No analyst estimates for ${symbol}`);
      continue;
    }
    
    for (const item of estimates) {
      try {
        await pool.query(`
          INSERT INTO fmp.analyst_estimates (
            symbol, date, estimated_revenue_low, estimated_revenue_high,
            estimated_revenue_avg, estimated_ebitda_low, estimated_ebitda_high,
            estimated_ebitda_avg, estimated_net_income_low, estimated_net_income_high,
            estimated_net_income_avg, estimated_eps_low, estimated_eps_high,
            estimated_eps_avg, number_analyst_estimated_revenue,
            number_analysts_estimated_eps
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (symbol, date) DO UPDATE SET
            estimated_revenue_avg = EXCLUDED.estimated_revenue_avg,
            estimated_eps_avg = EXCLUDED.estimated_eps_avg
        `, [
          item.symbol, item.date, item.estimatedRevenueLow, item.estimatedRevenueHigh,
          item.estimatedRevenueAvg, item.estimatedEbitdaLow, item.estimatedEbitdaHigh,
          item.estimatedEbitdaAvg, item.estimatedNetIncomeLow, item.estimatedNetIncomeHigh,
          item.estimatedNetIncomeAvg, item.estimatedEpsLow, item.estimatedEpsHigh,
          item.estimatedEpsAvg, item.numberAnalystEstimatedRevenue,
          item.numberAnalystsEstimatedEps
        ]);
        totalCount++;
      } catch (error) {
        console.error(`Error inserting analyst estimate for ${symbol}:`, error);
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} analyst estimate entries`);
  return totalCount;
}

// Load Key Metrics
async function loadKeyMetrics() {
  console.log('\n🔑 Loading Key Metrics...');
  
  const symbols = ['AAPL', 'MSFT'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const metrics = await fetchFromFMP(`/key-metrics/${symbol}?period=annual&limit=5`);
    if (!metrics || metrics.length === 0) {
      console.log(`No key metrics for ${symbol}`);
      continue;
    }
    
    for (const item of metrics) {
      try {
        await pool.query(`
          INSERT INTO fmp.key_metrics (
            symbol, date, period, revenue_per_share, net_income_per_share,
            operating_cash_flow_per_share, free_cash_flow_per_share,
            cash_per_share, book_value_per_share, market_cap, enterprise_value,
            pe_ratio, price_to_sales_ratio, pb_ratio, debt_to_equity,
            current_ratio, return_on_assets, return_on_equity,
            gross_profit_margin, operating_profit_margin, net_profit_margin
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
          ON CONFLICT (symbol, date, period) DO UPDATE SET
            pe_ratio = EXCLUDED.pe_ratio,
            market_cap = EXCLUDED.market_cap
        `, [
          item.symbol, item.date, item.period, item.revenuePerShare,
          item.netIncomePerShare, item.operatingCashFlowPerShare,
          item.freeCashFlowPerShare, item.cashPerShare, item.bookValuePerShare,
          item.marketCap, item.enterpriseValue, item.peRatio,
          item.priceToSalesRatio, item.pbRatio, item.debtToEquity,
          item.currentRatio, item.returnOnAssets, item.returnOnEquity,
          item.grossProfitMargin, item.operatingProfitMargin, item.netProfitMargin
        ]);
        totalCount++;
      } catch (error) {
        console.error(`Error inserting key metrics for ${symbol}:`, error);
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} key metrics entries`);
  return totalCount;
}

// Load Insider Trading (retry with different endpoint)
async function loadInsiderTradingV2() {
  console.log('\n👤 Loading Insider Trading (v4 endpoint)...');
  
  const symbols = ['AAPL', 'MSFT'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    // Try v4 endpoint
    const trades = await fetchFromFMP(`/insider-trading?symbol=${symbol}&page=0`);
    if (!trades || trades.length === 0) {
      console.log(`No insider trading data for ${symbol}`);
      continue;
    }
    
    for (const item of trades.slice(0, 50)) { // Limit to 50 per company
      try {
        await pool.query(`
          INSERT INTO fmp.insider_trading (
            symbol, filing_date, transaction_date, reporter_name,
            reporter_title, transaction_type, securities_owned,
            securities_transacted, price, security_name, link
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT DO NOTHING
        `, [
          item.symbol, item.filingDate, item.transactionDate,
          item.reportingName, item.typeOfOwner, item.transactionType,
          item.securitiesOwned, item.securitiesTransacted,
          item.price, item.securityName, item.link
        ]);
        totalCount++;
      } catch (error) {
        console.error(`Error inserting insider trade for ${symbol}:`, error);
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} insider trading entries`);
  return totalCount;
}

// Main loading function
async function loadPremiumFMPData() {
  console.log('🚀 Testing FMP Premium Data Load');
  console.log('=' .repeat(60));
  console.log('Testing various premium endpoints...');
  console.log('=' .repeat(60));
  
  try {
    // Load various data types
    await loadIncomeStatements();
    await loadBalanceSheets();
    await loadRealTimeQuotes();
    await loadHistoricalPrices();
    await loadAnalystEstimates();
    await loadKeyMetrics();
    await loadInsiderTradingV2();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ FMP Premium Data Load Test Complete!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('Fatal error during data load:', error);
  } finally {
    await pool.end();
  }
}

// Run the loader
loadPremiumFMPData().catch(console.error);