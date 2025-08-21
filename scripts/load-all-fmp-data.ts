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

// Helper function to format date
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Get date one year ago
function getOneYearAgo(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return formatDate(date);
}

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
    
    // Rate limit: 3000 requests per minute = 50 per second
    // Add small delay to avoid hitting limits
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return response.data;
  } catch (error: any) {
    console.error(`Error fetching ${endpoint}:`, error.message);
    return null;
  }
}

// Load earnings calendar
async function loadEarningsCalendar() {
  console.log('\n📊 Loading Earnings Calendar...');
  const from = getOneYearAgo();
  const to = formatDate(new Date());
  
  const data = await fetchFromFMP('/earning_calendar', { from, to });
  if (!data || data.length === 0) {
    console.log('No earnings calendar data found');
    return 0;
  }
  
  let count = 0;
  for (const item of data) {
    try {
      await pool.query(`
        INSERT INTO fmp.earnings_calendar (symbol, date, eps, eps_estimated, time, revenue, revenue_estimated, fiscal_date_ending, updated_from_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (symbol, date) DO UPDATE SET
          eps = EXCLUDED.eps,
          eps_estimated = EXCLUDED.eps_estimated,
          time = EXCLUDED.time,
          revenue = EXCLUDED.revenue,
          revenue_estimated = EXCLUDED.revenue_estimated
      `, [
        item.symbol,
        item.date,
        item.eps,
        item.epsEstimated,
        item.time,
        item.revenue,
        item.revenueEstimated,
        item.fiscalDateEnding,
        item.updatedFromDate
      ]);
      count++;
    } catch (error) {
      // Skip if symbol doesn't exist in companies table
    }
  }
  console.log(`✅ Loaded ${count} earnings calendar entries`);
  return count;
}

// Load economic calendar
async function loadEconomicCalendar() {
  console.log('\n📈 Loading Economic Calendar...');
  const from = getOneYearAgo();
  const to = formatDate(new Date());
  
  const data = await fetchFromFMP('/economic_calendar', { from, to });
  if (!data || data.length === 0) {
    console.log('No economic calendar data found');
    return 0;
  }
  
  let count = 0;
  for (const item of data) {
    try {
      await pool.query(`
        INSERT INTO fmp.economic_calendar (event, date, country, actual, previous, change, change_percentage, estimate, impact)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT DO NOTHING
      `, [
        item.event,
        item.date,
        item.country,
        item.actual,
        item.previous,
        item.change,
        item.changePercentage,
        item.estimate,
        item.impact
      ]);
      count++;
    } catch (error) {
      // Skip errors
    }
  }
  console.log(`✅ Loaded ${count} economic calendar entries`);
  return count;
}

// Load IPO calendar
async function loadIPOCalendar() {
  console.log('\n🚀 Loading IPO Calendar...');
  const from = getOneYearAgo();
  const to = formatDate(new Date());
  
  const data = await fetchFromFMP('/ipo_calendar', { from, to });
  if (!data || data.length === 0) {
    console.log('No IPO calendar data found');
    return 0;
  }
  
  let count = 0;
  for (const item of data) {
    try {
      await pool.query(`
        INSERT INTO fmp.ipo_calendar (date, company, symbol, exchange, actions, shares, price_range, market_cap)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [
        item.date,
        item.company,
        item.symbol,
        item.exchange,
        item.actions,
        item.shares,
        item.priceRange,
        item.marketCap
      ]);
      count++;
    } catch (error) {
      // Skip errors
    }
  }
  console.log(`✅ Loaded ${count} IPO calendar entries`);
  return count;
}

// Load stock split calendar
async function loadSplitCalendar() {
  console.log('\n✂️ Loading Stock Split Calendar...');
  const from = getOneYearAgo();
  const to = formatDate(new Date());
  
  const data = await fetchFromFMP('/stock_split_calendar', { from, to });
  if (!data || data.length === 0) {
    console.log('No stock split calendar data found');
    return 0;
  }
  
  let count = 0;
  for (const item of data) {
    try {
      await pool.query(`
        INSERT INTO fmp.split_calendar (date, label, symbol, numerator, denominator)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
      `, [
        item.date,
        item.label,
        item.symbol,
        item.numerator,
        item.denominator
      ]);
      count++;
    } catch (error) {
      // Skip errors
    }
  }
  console.log(`✅ Loaded ${count} stock split entries`);
  return count;
}

// Load dividend calendar
async function loadDividendCalendar() {
  console.log('\n💵 Loading Dividend Calendar...');
  const from = getOneYearAgo();
  const to = formatDate(new Date());
  
  const data = await fetchFromFMP('/stock_dividend_calendar', { from, to });
  if (!data || data.length === 0) {
    console.log('No dividend calendar data found');
    return 0;
  }
  
  let count = 0;
  for (const item of data) {
    try {
      await pool.query(`
        INSERT INTO fmp.dividend_calendar (date, label, symbol, dividend, adj_dividend, declaration_date, record_date, payment_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
      `, [
        item.date,
        item.label,
        item.symbol,
        item.dividend,
        item.adjDividend,
        item.declarationDate,
        item.recordDate,
        item.paymentDate
      ]);
      count++;
    } catch (error) {
      // Skip errors
    }
  }
  console.log(`✅ Loaded ${count} dividend entries`);
  return count;
}

// Load stock news
async function loadStockNews() {
  console.log('\n📰 Loading Stock News...');
  
  // Get news for major stocks
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'JPM', 'V', 'JNJ'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const data = await fetchFromFMP(`/stock_news?tickers=${symbol}&limit=100`);
    if (!data || data.length === 0) continue;
    
    for (const item of data) {
      try {
        await pool.query(`
          INSERT INTO fmp.news (symbol, published_date, title, image, site, text, url)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (url) DO NOTHING
        `, [
          item.symbol,
          item.publishedDate,
          item.title,
          item.image,
          item.site,
          item.text,
          item.url
        ]);
        totalCount++;
      } catch (error) {
        // Skip errors
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} stock news entries`);
  return totalCount;
}

// Load press releases
async function loadPressReleases() {
  console.log('\n📢 Loading Press Releases...');
  
  // Get press releases for major stocks
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const data = await fetchFromFMP(`/press-releases/${symbol}?limit=50`);
    if (!data || data.length === 0) continue;
    
    for (const item of data) {
      try {
        await pool.query(`
          INSERT INTO fmp.press_releases (symbol, date, title, text)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT DO NOTHING
        `, [
          item.symbol,
          item.date,
          item.title,
          item.text
        ]);
        totalCount++;
      } catch (error) {
        // Skip errors
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} press releases`);
  return totalCount;
}

// Load SEC filings
async function loadSECFilings() {
  console.log('\n📋 Loading SEC Filings...');
  
  // Get SEC filings for major stocks
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const data = await fetchFromFMP(`/sec_filings/${symbol}?limit=100`);
    if (!data || data.length === 0) continue;
    
    for (const item of data) {
      try {
        await pool.query(`
          INSERT INTO fmp.sec_filings (symbol, filing_date, accepted_date, cik, type, link, final_link)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          item.symbol,
          item.filingDate,
          item.acceptedDate,
          item.cik,
          item.type,
          item.link,
          item.finalLink
        ]);
        totalCount++;
      } catch (error) {
        // Skip errors
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} SEC filings`);
  return totalCount;
}

// Load insider trading data
async function loadInsiderTrading() {
  console.log('\n👥 Loading Insider Trading...');
  
  // Get insider trading for major stocks
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'];
  let totalCount = 0;
  
  for (const symbol of symbols) {
    const data = await fetchFromFMP(`/insider-trading?symbol=${symbol}&limit=100`);
    if (!data || data.length === 0) continue;
    
    for (const item of data) {
      try {
        await pool.query(`
          INSERT INTO fmp.insider_trading (symbol, filing_date, transaction_date, reporter_name, reporter_title, transaction_type, securities_owned, securities_transacted, price, security_name, link)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT DO NOTHING
        `, [
          item.symbol,
          item.filingDate,
          item.transactionDate,
          item.reporterName,
          item.reporterTitle,
          item.transactionType,
          item.securitiesOwned,
          item.securitiesTransacted,
          item.price,
          item.securityName,
          item.link
        ]);
        totalCount++;
      } catch (error) {
        // Skip errors
      }
    }
  }
  console.log(`✅ Loaded ${totalCount} insider trading entries`);
  return totalCount;
}

// Load companies first (needed for foreign key constraints)
async function loadCompanies() {
  console.log('\n🏢 Loading Companies...');
  
  // Get list of S&P 500 companies
  const data = await fetchFromFMP('/sp500_constituent');
  if (!data || data.length === 0) {
    console.log('No company data found');
    return 0;
  }
  
  let count = 0;
  for (const item of data) {
    // Get detailed company profile
    const profile = await fetchFromFMP(`/profile/${item.symbol}`);
    if (!profile || profile.length === 0) continue;
    
    const company = profile[0];
    try {
      await pool.query(`
        INSERT INTO fmp.companies (symbol, name, exchange, exchange_short_name, sector, industry, country, market_cap, employees, website, description, ceo, ipo_date)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (symbol) DO UPDATE SET
          name = EXCLUDED.name,
          market_cap = EXCLUDED.market_cap,
          updated_at = CURRENT_TIMESTAMP
      `, [
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
        company.ipoDate
      ]);
      count++;
    } catch (error) {
      console.error(`Error loading company ${item.symbol}:`, error);
    }
  }
  console.log(`✅ Loaded ${count} companies`);
  return count;
}

// Main loading function
async function loadAllFMPData() {
  console.log('🚀 Starting FMP Data Load');
  console.log('=' .repeat(60));
  console.log(`Loading data from: ${getOneYearAgo()} to ${formatDate(new Date())}`);
  console.log('=' .repeat(60));
  
  try {
    // Load companies first (needed for foreign keys)
    await loadCompanies();
    
    // Load calendar data
    await loadEarningsCalendar();
    await loadEconomicCalendar();
    await loadIPOCalendar();
    await loadSplitCalendar();
    await loadDividendCalendar();
    
    // Load news and filings
    await loadStockNews();
    await loadPressReleases();
    await loadSECFilings();
    await loadInsiderTrading();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ FMP Data Load Complete!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('Fatal error during data load:', error);
  } finally {
    await pool.end();
  }
}

// Run the loader
loadAllFMPData().catch(console.error);