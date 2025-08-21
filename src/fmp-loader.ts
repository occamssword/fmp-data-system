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

// Helper function to make FMP API requests
async function fetchFMPData(endpoint: string, params: Record<string, any> = {}) {
  try {
    const url = `${FMP_BASE_URL}${endpoint}`;
    const response = await axios.get(url, {
      params: {
        ...params,
        apikey: FMP_API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching data from FMP API: ${endpoint}`, error);
    throw error;
  }
}

// Load company profile data
export async function loadCompanyProfile(symbol: string) {
  try {
    console.log(`Loading company profile for ${symbol}...`);
    const data = await fetchFMPData(`/profile/${symbol}`);
    
    if (!data || data.length === 0) {
      console.log(`No data found for ${symbol}`);
      return;
    }

    const company = data[0];
    const query = `
      INSERT INTO financial_data.companies (
        symbol, name, exchange, exchange_short_name, sector, industry,
        country, market_cap, employees, website, description, ceo, ipo_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (symbol) DO UPDATE SET
        name = EXCLUDED.name,
        exchange = EXCLUDED.exchange,
        exchange_short_name = EXCLUDED.exchange_short_name,
        sector = EXCLUDED.sector,
        industry = EXCLUDED.industry,
        country = EXCLUDED.country,
        market_cap = EXCLUDED.market_cap,
        employees = EXCLUDED.employees,
        website = EXCLUDED.website,
        description = EXCLUDED.description,
        ceo = EXCLUDED.ceo,
        ipo_date = EXCLUDED.ipo_date,
        updated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      company.symbol,
      company.companyName,
      company.exchange,
      company.exchangeShortName,
      company.sector,
      company.industry,
      company.country,
      company.mktCap,
      company.fullTimeEmployees,
      company.website,
      company.description,
      company.ceo,
      company.ipoDate ? new Date(company.ipoDate) : null
    ]);

    console.log(`Successfully loaded company profile for ${symbol}`);
  } catch (error) {
    console.error(`Error loading company profile for ${symbol}:`, error);
    throw error;
  }
}

// Load historical stock prices
export async function loadHistoricalPrices(symbol: string, from?: string, to?: string) {
  try {
    console.log(`Loading historical prices for ${symbol}...`);
    const params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;
    
    const data = await fetchFMPData(`/historical-price-full/${symbol}`, params);
    
    if (!data || !data.historical) {
      console.log(`No historical data found for ${symbol}`);
      return;
    }

    const query = `
      INSERT INTO financial_data.stock_prices (
        symbol, date, open, high, low, close, adj_close, volume,
        unadjusted_volume, change, change_percent, vwap
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (symbol, date) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close,
        adj_close = EXCLUDED.adj_close,
        volume = EXCLUDED.volume,
        unadjusted_volume = EXCLUDED.unadjusted_volume,
        change = EXCLUDED.change,
        change_percent = EXCLUDED.change_percent,
        vwap = EXCLUDED.vwap
    `;

    for (const price of data.historical) {
      await pool.query(query, [
        symbol,
        new Date(price.date),
        price.open,
        price.high,
        price.low,
        price.close,
        price.adjClose,
        price.volume,
        price.unadjustedVolume,
        price.change,
        price.changePercent,
        price.vwap
      ]);
    }

    console.log(`Successfully loaded ${data.historical.length} price records for ${symbol}`);
  } catch (error) {
    console.error(`Error loading historical prices for ${symbol}:`, error);
    throw error;
  }
}

// Load income statements
export async function loadIncomeStatements(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 10) {
  try {
    console.log(`Loading ${period} income statements for ${symbol}...`);
    const data = await fetchFMPData(`/income-statement/${symbol}`, { period, limit });
    
    if (!data || data.length === 0) {
      console.log(`No income statement data found for ${symbol}`);
      return;
    }

    const query = `
      INSERT INTO financial_data.income_statements (
        symbol, date, period, revenue, cost_of_revenue, gross_profit,
        gross_profit_ratio, research_and_development_expenses,
        general_and_administrative_expenses, selling_and_marketing_expenses,
        operating_expenses, cost_and_expenses, interest_expense,
        depreciation_and_amortization, ebitda, ebitda_ratio,
        operating_income, operating_income_ratio, total_other_income_expenses_net,
        income_before_tax, income_before_tax_ratio, income_tax_expense,
        net_income, net_income_ratio, eps, eps_diluted,
        weighted_average_shares_outstanding, weighted_average_shares_outstanding_diluted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
      ON CONFLICT (symbol, date, period) DO UPDATE SET
        revenue = EXCLUDED.revenue,
        cost_of_revenue = EXCLUDED.cost_of_revenue,
        gross_profit = EXCLUDED.gross_profit,
        gross_profit_ratio = EXCLUDED.gross_profit_ratio,
        research_and_development_expenses = EXCLUDED.research_and_development_expenses,
        general_and_administrative_expenses = EXCLUDED.general_and_administrative_expenses,
        selling_and_marketing_expenses = EXCLUDED.selling_and_marketing_expenses,
        operating_expenses = EXCLUDED.operating_expenses,
        cost_and_expenses = EXCLUDED.cost_and_expenses,
        interest_expense = EXCLUDED.interest_expense,
        depreciation_and_amortization = EXCLUDED.depreciation_and_amortization,
        ebitda = EXCLUDED.ebitda,
        ebitda_ratio = EXCLUDED.ebitda_ratio,
        operating_income = EXCLUDED.operating_income,
        operating_income_ratio = EXCLUDED.operating_income_ratio,
        total_other_income_expenses_net = EXCLUDED.total_other_income_expenses_net,
        income_before_tax = EXCLUDED.income_before_tax,
        income_before_tax_ratio = EXCLUDED.income_before_tax_ratio,
        income_tax_expense = EXCLUDED.income_tax_expense,
        net_income = EXCLUDED.net_income,
        net_income_ratio = EXCLUDED.net_income_ratio,
        eps = EXCLUDED.eps,
        eps_diluted = EXCLUDED.eps_diluted,
        weighted_average_shares_outstanding = EXCLUDED.weighted_average_shares_outstanding,
        weighted_average_shares_outstanding_diluted = EXCLUDED.weighted_average_shares_outstanding_diluted
    `;

    for (const statement of data) {
      await pool.query(query, [
        symbol,
        new Date(statement.date),
        statement.period,
        statement.revenue,
        statement.costOfRevenue,
        statement.grossProfit,
        statement.grossProfitRatio,
        statement.researchAndDevelopmentExpenses,
        statement.generalAndAdministrativeExpenses,
        statement.sellingAndMarketingExpenses,
        statement.operatingExpenses,
        statement.costAndExpenses,
        statement.interestExpense,
        statement.depreciationAndAmortization,
        statement.ebitda,
        statement.ebitdaratio,
        statement.operatingIncome,
        statement.operatingIncomeRatio,
        statement.totalOtherIncomeExpensesNet,
        statement.incomeBeforeTax,
        statement.incomeBeforeTaxRatio,
        statement.incomeTaxExpense,
        statement.netIncome,
        statement.netIncomeRatio,
        statement.eps,
        statement.epsdiluted,
        statement.weightedAverageShsOut,
        statement.weightedAverageShsOutDil
      ]);
    }

    console.log(`Successfully loaded ${data.length} income statements for ${symbol}`);
  } catch (error) {
    console.error(`Error loading income statements for ${symbol}:`, error);
    throw error;
  }
}

// Load balance sheets
export async function loadBalanceSheets(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 10) {
  try {
    console.log(`Loading ${period} balance sheets for ${symbol}...`);
    const data = await fetchFMPData(`/balance-sheet-statement/${symbol}`, { period, limit });
    
    if (!data || data.length === 0) {
      console.log(`No balance sheet data found for ${symbol}`);
      return;
    }

    const query = `
      INSERT INTO financial_data.balance_sheets (
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
        cash_and_cash_equivalents = EXCLUDED.cash_and_cash_equivalents,
        short_term_investments = EXCLUDED.short_term_investments,
        cash_and_short_term_investments = EXCLUDED.cash_and_short_term_investments,
        net_receivables = EXCLUDED.net_receivables,
        inventory = EXCLUDED.inventory,
        other_current_assets = EXCLUDED.other_current_assets,
        total_current_assets = EXCLUDED.total_current_assets,
        property_plant_equipment_net = EXCLUDED.property_plant_equipment_net,
        goodwill = EXCLUDED.goodwill,
        intangible_assets = EXCLUDED.intangible_assets,
        long_term_investments = EXCLUDED.long_term_investments,
        tax_assets = EXCLUDED.tax_assets,
        other_non_current_assets = EXCLUDED.other_non_current_assets,
        total_non_current_assets = EXCLUDED.total_non_current_assets,
        total_assets = EXCLUDED.total_assets,
        accounts_payables = EXCLUDED.accounts_payables,
        short_term_debt = EXCLUDED.short_term_debt,
        tax_payables = EXCLUDED.tax_payables,
        deferred_revenue = EXCLUDED.deferred_revenue,
        other_current_liabilities = EXCLUDED.other_current_liabilities,
        total_current_liabilities = EXCLUDED.total_current_liabilities,
        long_term_debt = EXCLUDED.long_term_debt,
        deferred_revenue_non_current = EXCLUDED.deferred_revenue_non_current,
        deferred_tax_liabilities_non_current = EXCLUDED.deferred_tax_liabilities_non_current,
        other_non_current_liabilities = EXCLUDED.other_non_current_liabilities,
        total_non_current_liabilities = EXCLUDED.total_non_current_liabilities,
        total_liabilities = EXCLUDED.total_liabilities,
        common_stock = EXCLUDED.common_stock,
        retained_earnings = EXCLUDED.retained_earnings,
        accumulated_other_comprehensive_income_loss = EXCLUDED.accumulated_other_comprehensive_income_loss,
        total_stockholders_equity = EXCLUDED.total_stockholders_equity,
        total_liabilities_and_stockholders_equity = EXCLUDED.total_liabilities_and_stockholders_equity
    `;

    for (const sheet of data) {
      await pool.query(query, [
        symbol,
        new Date(sheet.date),
        sheet.period,
        sheet.cashAndCashEquivalents,
        sheet.shortTermInvestments,
        sheet.cashAndShortTermInvestments,
        sheet.netReceivables,
        sheet.inventory,
        sheet.otherCurrentAssets,
        sheet.totalCurrentAssets,
        sheet.propertyPlantEquipmentNet,
        sheet.goodwill,
        sheet.intangibleAssets,
        sheet.longTermInvestments,
        sheet.taxAssets,
        sheet.otherNonCurrentAssets,
        sheet.totalNonCurrentAssets,
        sheet.totalAssets,
        sheet.accountPayables,
        sheet.shortTermDebt,
        sheet.taxPayables,
        sheet.deferredRevenue,
        sheet.otherCurrentLiabilities,
        sheet.totalCurrentLiabilities,
        sheet.longTermDebt,
        sheet.deferredRevenueNonCurrent,
        sheet.deferredTaxLiabilitiesNonCurrent,
        sheet.otherNonCurrentLiabilities,
        sheet.totalNonCurrentLiabilities,
        sheet.totalLiabilities,
        sheet.commonStock,
        sheet.retainedEarnings,
        sheet.accumulatedOtherComprehensiveIncomeLoss,
        sheet.totalStockholdersEquity,
        sheet.totalLiabilitiesAndStockholdersEquity
      ]);
    }

    console.log(`Successfully loaded ${data.length} balance sheets for ${symbol}`);
  } catch (error) {
    console.error(`Error loading balance sheets for ${symbol}:`, error);
    throw error;
  }
}

// Load cash flow statements
export async function loadCashFlowStatements(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 10) {
  try {
    console.log(`Loading ${period} cash flow statements for ${symbol}...`);
    const data = await fetchFMPData(`/cash-flow-statement/${symbol}`, { period, limit });
    
    if (!data || data.length === 0) {
      console.log(`No cash flow data found for ${symbol}`);
      return;
    }

    const query = `
      INSERT INTO financial_data.cash_flow_statements (
        symbol, date, period, net_income, depreciation_and_amortization,
        deferred_income_tax, stock_based_compensation, change_in_working_capital,
        accounts_receivables, inventory, accounts_payables, other_working_capital,
        other_non_cash_items, net_cash_provided_by_operating_activities,
        investments_in_property_plant_and_equipment, acquisitions_net,
        purchases_of_investments, sales_maturities_of_investments,
        other_investing_activities, net_cash_used_for_investing_activities,
        debt_repayment, common_stock_issued, common_stock_repurchased,
        dividends_paid, other_financing_activities,
        net_cash_used_provided_by_financing_activities, net_change_in_cash,
        cash_at_beginning_of_period, cash_at_end_of_period, free_cash_flow
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      ON CONFLICT (symbol, date, period) DO UPDATE SET
        net_income = EXCLUDED.net_income,
        depreciation_and_amortization = EXCLUDED.depreciation_and_amortization,
        deferred_income_tax = EXCLUDED.deferred_income_tax,
        stock_based_compensation = EXCLUDED.stock_based_compensation,
        change_in_working_capital = EXCLUDED.change_in_working_capital,
        accounts_receivables = EXCLUDED.accounts_receivables,
        inventory = EXCLUDED.inventory,
        accounts_payables = EXCLUDED.accounts_payables,
        other_working_capital = EXCLUDED.other_working_capital,
        other_non_cash_items = EXCLUDED.other_non_cash_items,
        net_cash_provided_by_operating_activities = EXCLUDED.net_cash_provided_by_operating_activities,
        investments_in_property_plant_and_equipment = EXCLUDED.investments_in_property_plant_and_equipment,
        acquisitions_net = EXCLUDED.acquisitions_net,
        purchases_of_investments = EXCLUDED.purchases_of_investments,
        sales_maturities_of_investments = EXCLUDED.sales_maturities_of_investments,
        other_investing_activities = EXCLUDED.other_investing_activities,
        net_cash_used_for_investing_activities = EXCLUDED.net_cash_used_for_investing_activities,
        debt_repayment = EXCLUDED.debt_repayment,
        common_stock_issued = EXCLUDED.common_stock_issued,
        common_stock_repurchased = EXCLUDED.common_stock_repurchased,
        dividends_paid = EXCLUDED.dividends_paid,
        other_financing_activities = EXCLUDED.other_financing_activities,
        net_cash_used_provided_by_financing_activities = EXCLUDED.net_cash_used_provided_by_financing_activities,
        net_change_in_cash = EXCLUDED.net_change_in_cash,
        cash_at_beginning_of_period = EXCLUDED.cash_at_beginning_of_period,
        cash_at_end_of_period = EXCLUDED.cash_at_end_of_period,
        free_cash_flow = EXCLUDED.free_cash_flow
    `;

    for (const statement of data) {
      await pool.query(query, [
        symbol,
        new Date(statement.date),
        statement.period,
        statement.netIncome,
        statement.depreciationAndAmortization,
        statement.deferredIncomeTax,
        statement.stockBasedCompensation,
        statement.changeInWorkingCapital,
        statement.accountsReceivables,
        statement.inventory,
        statement.accountsPayables,
        statement.otherWorkingCapital,
        statement.otherNonCashItems,
        statement.netCashProvidedByOperatingActivities,
        statement.investmentsInPropertyPlantAndEquipment,
        statement.acquisitionsNet,
        statement.purchasesOfInvestments,
        statement.salesMaturitiesOfInvestments,
        statement.otherInvestingActivites,
        statement.netCashUsedForInvestingActivites,
        statement.debtRepayment,
        statement.commonStockIssued,
        statement.commonStockRepurchased,
        statement.dividendsPaid,
        statement.otherFinancingActivites,
        statement.netCashUsedProvidedByFinancingActivities,
        statement.netChangeInCash,
        statement.cashAtBeginningOfPeriod,
        statement.cashAtEndOfPeriod,
        statement.freeCashFlow
      ]);
    }

    console.log(`Successfully loaded ${data.length} cash flow statements for ${symbol}`);
  } catch (error) {
    console.error(`Error loading cash flow statements for ${symbol}:`, error);
    throw error;
  }
}

// Load key metrics
export async function loadKeyMetrics(symbol: string, period: 'annual' | 'quarter' = 'annual', limit: number = 10) {
  try {
    console.log(`Loading ${period} key metrics for ${symbol}...`);
    const data = await fetchFMPData(`/key-metrics/${symbol}`, { period, limit });
    
    if (!data || data.length === 0) {
      console.log(`No key metrics data found for ${symbol}`);
      return;
    }

    const query = `
      INSERT INTO financial_data.key_metrics (
        symbol, date, period, revenue_per_share, net_income_per_share,
        operating_cash_flow_per_share, free_cash_flow_per_share, cash_per_share,
        book_value_per_share, tangible_book_value_per_share,
        shareholders_equity_per_share, interest_debt_per_share, market_cap,
        enterprise_value, pe_ratio, price_to_sales_ratio, pocfratio,
        pfcf_ratio, pb_ratio, ptb_ratio, ev_to_sales,
        enterprise_value_over_ebitda, ev_to_operating_cash_flow,
        ev_to_free_cash_flow, earnings_yield, free_cash_flow_yield,
        debt_to_equity, debt_to_assets, net_debt_to_ebitda, current_ratio,
        interest_coverage, income_quality, dividend_yield, payout_ratio,
        return_on_assets, return_on_equity, gross_profit_margin,
        operating_profit_margin, net_profit_margin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38)
      ON CONFLICT (symbol, date, period) DO UPDATE SET
        revenue_per_share = EXCLUDED.revenue_per_share,
        net_income_per_share = EXCLUDED.net_income_per_share,
        operating_cash_flow_per_share = EXCLUDED.operating_cash_flow_per_share,
        free_cash_flow_per_share = EXCLUDED.free_cash_flow_per_share,
        cash_per_share = EXCLUDED.cash_per_share,
        book_value_per_share = EXCLUDED.book_value_per_share,
        tangible_book_value_per_share = EXCLUDED.tangible_book_value_per_share,
        shareholders_equity_per_share = EXCLUDED.shareholders_equity_per_share,
        interest_debt_per_share = EXCLUDED.interest_debt_per_share,
        market_cap = EXCLUDED.market_cap,
        enterprise_value = EXCLUDED.enterprise_value,
        pe_ratio = EXCLUDED.pe_ratio,
        price_to_sales_ratio = EXCLUDED.price_to_sales_ratio,
        pocfratio = EXCLUDED.pocfratio,
        pfcf_ratio = EXCLUDED.pfcf_ratio,
        pb_ratio = EXCLUDED.pb_ratio,
        ptb_ratio = EXCLUDED.ptb_ratio,
        ev_to_sales = EXCLUDED.ev_to_sales,
        enterprise_value_over_ebitda = EXCLUDED.enterprise_value_over_ebitda,
        ev_to_operating_cash_flow = EXCLUDED.ev_to_operating_cash_flow,
        ev_to_free_cash_flow = EXCLUDED.ev_to_free_cash_flow,
        earnings_yield = EXCLUDED.earnings_yield,
        free_cash_flow_yield = EXCLUDED.free_cash_flow_yield,
        debt_to_equity = EXCLUDED.debt_to_equity,
        debt_to_assets = EXCLUDED.debt_to_assets,
        net_debt_to_ebitda = EXCLUDED.net_debt_to_ebitda,
        current_ratio = EXCLUDED.current_ratio,
        interest_coverage = EXCLUDED.interest_coverage,
        income_quality = EXCLUDED.income_quality,
        dividend_yield = EXCLUDED.dividend_yield,
        payout_ratio = EXCLUDED.payout_ratio,
        return_on_assets = EXCLUDED.return_on_assets,
        return_on_equity = EXCLUDED.return_on_equity,
        gross_profit_margin = EXCLUDED.gross_profit_margin,
        operating_profit_margin = EXCLUDED.operating_profit_margin,
        net_profit_margin = EXCLUDED.net_profit_margin
    `;

    for (const metrics of data) {
      await pool.query(query, [
        symbol,
        new Date(metrics.date),
        metrics.period,
        metrics.revenuePerShare,
        metrics.netIncomePerShare,
        metrics.operatingCashFlowPerShare,
        metrics.freeCashFlowPerShare,
        metrics.cashPerShare,
        metrics.bookValuePerShare,
        metrics.tangibleBookValuePerShare,
        metrics.shareholdersEquityPerShare,
        metrics.interestDebtPerShare,
        metrics.marketCap,
        metrics.enterpriseValue,
        metrics.peRatio,
        metrics.priceToSalesRatio,
        metrics.pocfratio,
        metrics.pfcfRatio,
        metrics.pbRatio,
        metrics.ptbRatio,
        metrics.evToSales,
        metrics.enterpriseValueOverEBITDA,
        metrics.evToOperatingCashFlow,
        metrics.evToFreeCashFlow,
        metrics.earningsYield,
        metrics.freeCashFlowYield,
        metrics.debtToEquity,
        metrics.debtToAssets,
        metrics.netDebtToEBITDA,
        metrics.currentRatio,
        metrics.interestCoverage,
        metrics.incomeQuality,
        metrics.dividendYield,
        metrics.payoutRatio,
        metrics.returnOnAssets,
        metrics.returnOnEquity,
        metrics.grossProfitMargin,
        metrics.operatingProfitMargin,
        metrics.netProfitMargin
      ]);
    }

    console.log(`Successfully loaded ${data.length} key metrics for ${symbol}`);
  } catch (error) {
    console.error(`Error loading key metrics for ${symbol}:`, error);
    throw error;
  }
}

// Load all financial data for a symbol
export async function loadAllFinancialData(symbol: string, period: 'annual' | 'quarter' = 'annual') {
  try {
    console.log(`Loading all financial data for ${symbol} (${period})...`);
    
    // Load company profile first
    await loadCompanyProfile(symbol);
    
    // Load all financial statements
    await Promise.all([
      loadIncomeStatements(symbol, period),
      loadBalanceSheets(symbol, period),
      loadCashFlowStatements(symbol, period),
      loadKeyMetrics(symbol, period)
    ]);
    
    // Load historical prices (last year)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);
    
    await loadHistoricalPrices(
      symbol,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    console.log(`Successfully loaded all financial data for ${symbol}`);
  } catch (error) {
    console.error(`Error loading all financial data for ${symbol}:`, error);
    throw error;
  }
}

// Load batch of symbols
export async function loadBatchSymbols(symbols: string[], period: 'annual' | 'quarter' = 'annual') {
  console.log(`Loading data for ${symbols.length} symbols...`);
  
  for (const symbol of symbols) {
    try {
      await loadAllFinancialData(symbol, period);
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Failed to load data for ${symbol}, continuing with next...`, error);
    }
  }
  
  console.log('Batch loading completed');
}

// Main function for testing
async function main() {
  try {
    // Test with a few popular stocks
    const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'];
    
    console.log('Starting FMP data loader test...');
    console.log(`API Key: ${FMP_API_KEY ? 'Configured' : 'Missing'}`);
    
    // Load data for test symbols
    await loadBatchSymbols(testSymbols, 'annual');
    
    console.log('FMP data loader test completed successfully');
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await pool.end();
  }
}

// Export the main function and individual loaders
export { main, pool };