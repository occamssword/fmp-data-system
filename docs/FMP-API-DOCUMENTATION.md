# FMP API Documentation

## Overview
Financial Modeling Prep (FMP) provides comprehensive financial data APIs covering stocks, ETFs, mutual funds, forex, cryptocurrencies, commodities, and economic indicators.

API Base URL: `https://financialmodelingprep.com/api/v3`
API Key: Stored in `.env` as `FMP_API_KEY`

## Available Datasets and Endpoints

### 1. Company Information

#### Company Profile
- **Endpoint**: `/profile/{symbol}`
- **Description**: Comprehensive company overview including sector, industry, CEO, employees, etc.
- **Database Tables**: `financial_data.companies`

#### Company Executives
- **Endpoint**: `/key-executives/{symbol}`
- **Description**: Executive team information
- **Database Table**: `financial_data.executives` (to be created)

#### Company Outlook
- **Endpoint**: `/company-outlook`
- **Description**: Combined company data including profile, metrics, ratios, and insider trading

### 2. Financial Statements

#### Income Statement
- **Endpoint**: `/income-statement/{symbol}`
- **Parameters**: `period` (annual/quarter), `limit`
- **Database Table**: `financial_data.income_statements`

#### Balance Sheet
- **Endpoint**: `/balance-sheet-statement/{symbol}`
- **Parameters**: `period` (annual/quarter), `limit`
- **Database Table**: `financial_data.balance_sheets`

#### Cash Flow Statement
- **Endpoint**: `/cash-flow-statement/{symbol}`
- **Parameters**: `period` (annual/quarter), `limit`
- **Database Table**: `financial_data.cash_flow_statements`

#### Financial Statement Full (As Reported)
- **Endpoint**: `/financial-statement-full-as-reported/{symbol}`
- **Description**: SEC filed statements as reported

### 3. Financial Metrics & Ratios

#### Key Metrics
- **Endpoint**: `/key-metrics/{symbol}`
- **Description**: Important financial metrics like P/E, P/B, ROE, etc.
- **Database Table**: `financial_data.key_metrics`

#### Financial Ratios
- **Endpoint**: `/ratios/{symbol}`
- **Description**: Comprehensive financial ratios
- **Database Table**: `financial_data.financial_ratios`

#### Financial Growth
- **Endpoint**: `/financial-growth/{symbol}`
- **Description**: Year-over-year growth metrics
- **Database Table**: `financial_data.financial_growth` (to be created)

#### Enterprise Value
- **Endpoint**: `/enterprise-values/{symbol}`
- **Description**: Enterprise value calculations
- **Database Table**: `financial_data.enterprise_values` (to be created)

### 4. Market Data

#### Stock Quote
- **Endpoint**: `/quote/{symbol}`
- **Description**: Real-time stock quote
- **Database Table**: `financial_data.real_time_quotes` (to be created)

#### Historical Stock Prices
- **Endpoint**: `/historical-price-full/{symbol}`
- **Parameters**: `from`, `to`, `timeseries`
- **Database Table**: `financial_data.stock_prices`

#### Intraday Prices
- **Endpoint**: `/historical-chart/{interval}/{symbol}`
- **Intervals**: 1min, 5min, 15min, 30min, 1hour, 4hour
- **Database Table**: `financial_data.intraday_prices` (to be created)

#### Stock Price Change
- **Endpoint**: `/stock-price-change/{symbol}`
- **Description**: Price changes over various periods

### 5. Dividends & Splits

#### Historical Dividends
- **Endpoint**: `/historical-price-full/stock_dividend/{symbol}`
- **Database Table**: `financial_data.dividends` (to be created)

#### Stock Splits
- **Endpoint**: `/historical-price-full/stock_split/{symbol}`
- **Database Table**: `financial_data.stock_splits` (to be created)

### 6. Analyst Data

#### Analyst Estimates
- **Endpoint**: `/analyst-estimates/{symbol}`
- **Description**: Consensus analyst estimates
- **Database Table**: `financial_data.analyst_estimates` (to be created)

#### Price Targets
- **Endpoint**: `/price-target/{symbol}`
- **Description**: Analyst price targets
- **Database Table**: `financial_data.price_targets` (to be created)

#### Stock Grade
- **Endpoint**: `/grade/{symbol}`
- **Description**: Stock ratings from various firms
- **Database Table**: `financial_data.stock_grades` (to be created)

#### Earnings Surprises
- **Endpoint**: `/earnings-surprises/{symbol}`
- **Database Table**: `financial_data.earnings_surprises` (to be created)

### 7. Institutional & Insider Data

#### Institutional Holders
- **Endpoint**: `/institutional-holder/{symbol}`
- **Database Table**: `financial_data.institutional_holders` (to be created)

#### Insider Trading
- **Endpoint**: `/insider-trading`
- **Parameters**: `symbol`, `transactionType`
- **Database Table**: `financial_data.insider_trading` (to be created)

#### SEC Filings
- **Endpoint**: `/sec_filings/{symbol}`
- **Database Table**: `financial_data.sec_filings` (to be created)

### 8. ETF Data

#### ETF Holdings
- **Endpoint**: `/etf-holder/{symbol}`
- **Description**: ETF holdings and weights
- **Database Table**: `financial_data.etf_holdings` (to be created)

#### ETF Sector Weightings
- **Endpoint**: `/etf-sector-weightings/{symbol}`
- **Database Table**: `financial_data.etf_sector_weights` (to be created)

#### ETF Country Weightings
- **Endpoint**: `/etf-country-weightings/{symbol}`
- **Database Table**: `financial_data.etf_country_weights` (to be created)

### 9. Market Indexes

#### Major Indexes
- **Endpoint**: `/quotes/index`
- **Available**: S&P 500, NASDAQ, Dow Jones, Russell 2000
- **Database Table**: `financial_data.market_indexes` (to be created)

#### Index Historical Prices
- **Endpoint**: `/historical-price-full/index/{index}`
- **Database Table**: `financial_data.index_prices` (to be created)

### 10. Economic Data

#### Economic Calendar
- **Endpoint**: `/economic_calendar`
- **Parameters**: `from`, `to`
- **Database Table**: `financial_data.economic_calendar` (to be created)

#### Treasury Rates
- **Endpoint**: `/treasury`
- **Parameters**: `from`, `to`
- **Database Table**: `financial_data.treasury_rates` (to be created)

### 11. Cryptocurrency

#### Crypto Quotes
- **Endpoint**: `/quote/{cryptoSymbol}`
- **Database Table**: `financial_data.crypto_quotes` (to be created)

#### Historical Crypto Prices
- **Endpoint**: `/historical-price-full/crypto/{symbol}`
- **Database Table**: `financial_data.crypto_prices` (to be created)

### 12. Forex

#### Forex Quotes
- **Endpoint**: `/fx`
- **Database Table**: `financial_data.forex_quotes` (to be created)

#### Historical Forex
- **Endpoint**: `/historical-price-full/{pair}`
- **Database Table**: `financial_data.forex_prices` (to be created)

### 13. Commodities

#### Commodities Quotes
- **Endpoint**: `/quote/{commodity}`
- **Available**: Gold, Silver, Oil, Natural Gas, etc.
- **Database Table**: `financial_data.commodity_quotes` (to be created)

#### Historical Commodities
- **Endpoint**: `/historical-price-full/{commodity}`
- **Database Table**: `financial_data.commodity_prices` (to be created)

### 14. News & Sentiment

#### Stock News
- **Endpoint**: `/stock_news`
- **Parameters**: `tickers`, `limit`, `from`, `to`
- **Database Table**: `financial_data.news`

#### Press Releases
- **Endpoint**: `/press-releases/{symbol}`
- **Database Table**: `financial_data.press_releases` (to be created)

#### Social Sentiment
- **Endpoint**: `/social-sentiment/trending`
- **Database Table**: `financial_data.social_sentiment` (to be created)

### 15. Screeners & Search

#### Stock Screener
- **Endpoint**: `/stock-screener`
- **Parameters**: Various filters (marketCap, price, volume, sector, etc.)

#### Symbol Search
- **Endpoint**: `/search`
- **Parameters**: `query`, `limit`

#### Available Symbols List
- **Endpoint**: `/stock/list`
- **Database Table**: `financial_data.symbols_list` (to be created)

### 16. Calendar Data

#### Earnings Calendar
- **Endpoint**: `/earning_calendar`
- **Parameters**: `from`, `to`
- **Database Table**: `financial_data.earnings_calendar`

#### IPO Calendar
- **Endpoint**: `/ipo_calendar`
- **Parameters**: `from`, `to`
- **Database Table**: `financial_data.ipo_calendar` (to be created)

#### Stock Split Calendar
- **Endpoint**: `/stock_split_calendar`
- **Parameters**: `from`, `to`
- **Database Table**: `financial_data.split_calendar` (to be created)

#### Dividend Calendar
- **Endpoint**: `/stock_dividend_calendar`
- **Parameters**: `from`, `to`
- **Database Table**: `financial_data.dividend_calendar` (to be created)

## Database Schema Status

### Existing Tables
- ✅ `financial_data.companies`
- ✅ `financial_data.stock_prices`
- ✅ `financial_data.income_statements`
- ✅ `financial_data.balance_sheets`
- ✅ `financial_data.cash_flow_statements`
- ✅ `financial_data.key_metrics`
- ✅ `financial_data.financial_ratios`
- ✅ `financial_data.news`
- ✅ `financial_data.earnings_calendar`
- ✅ `financial_data.economic_indicators`

### Tables to Create
- ⏳ `financial_data.executives`
- ⏳ `financial_data.financial_growth`
- ⏳ `financial_data.enterprise_values`
- ⏳ `financial_data.real_time_quotes`
- ⏳ `financial_data.intraday_prices`
- ⏳ `financial_data.dividends`
- ⏳ `financial_data.stock_splits`
- ⏳ `financial_data.analyst_estimates`
- ⏳ `financial_data.price_targets`
- ⏳ `financial_data.stock_grades`
- ⏳ `financial_data.earnings_surprises`
- ⏳ `financial_data.institutional_holders`
- ⏳ `financial_data.insider_trading`
- ⏳ `financial_data.sec_filings`
- ⏳ `financial_data.etf_holdings`
- ⏳ `financial_data.etf_sector_weights`
- ⏳ `financial_data.etf_country_weights`
- ⏳ `financial_data.market_indexes`
- ⏳ `financial_data.index_prices`
- ⏳ `financial_data.economic_calendar`
- ⏳ `financial_data.treasury_rates`
- ⏳ `financial_data.crypto_quotes`
- ⏳ `financial_data.crypto_prices`
- ⏳ `financial_data.forex_quotes`
- ⏳ `financial_data.forex_prices`
- ⏳ `financial_data.commodity_quotes`
- ⏳ `financial_data.commodity_prices`
- ⏳ `financial_data.press_releases`
- ⏳ `financial_data.social_sentiment`
- ⏳ `financial_data.symbols_list`
- ⏳ `financial_data.ipo_calendar`
- ⏳ `financial_data.split_calendar`
- ⏳ `financial_data.dividend_calendar`

## Rate Limits
- Free tier: 250 API calls per day
- Paid tiers: Higher limits available
- Recommendation: Implement caching and batch requests

## Implementation Priority

### Phase 1 (Core Financial Data) - COMPLETED
1. Company profiles
2. Financial statements (Income, Balance Sheet, Cash Flow)
3. Key metrics and ratios
4. Historical stock prices
5. Basic news feed

### Phase 2 (Market & Analyst Data)
1. Real-time quotes
2. Analyst estimates and price targets
3. Insider trading
4. Institutional holdings
5. Earnings calendar and surprises

### Phase 3 (Extended Markets)
1. ETF data and holdings
2. Market indexes
3. Economic indicators
4. Treasury rates

### Phase 4 (Alternative Assets)
1. Cryptocurrency data
2. Forex data
3. Commodities data
4. Social sentiment

### Phase 5 (Advanced Features)
1. Intraday data
2. Options data
3. SEC filings parsing
4. Advanced screeners

## Usage Examples

### Loading Company Data
```typescript
import { loadCompanyProfile, loadAllFinancialData } from './src/fmp-loader';

// Load single company
await loadCompanyProfile('AAPL');

// Load all financial data
await loadAllFinancialData('AAPL', 'annual');
```

### Batch Loading
```typescript
import { loadBatchSymbols } from './src/fmp-loader';

const symbols = ['AAPL', 'MSFT', 'GOOGL'];
await loadBatchSymbols(symbols, 'annual');
```

### Query Examples
```sql
-- Get latest metrics for tech companies
SELECT c.symbol, c.name, km.pe_ratio, km.return_on_equity, km.market_cap
FROM financial_data.companies c
JOIN financial_data.key_metrics km ON c.symbol = km.symbol
WHERE c.sector = 'Technology'
  AND km.date = (SELECT MAX(date) FROM financial_data.key_metrics WHERE symbol = c.symbol)
ORDER BY km.market_cap DESC;

-- Compare revenue growth
SELECT 
    symbol,
    date,
    revenue,
    LAG(revenue) OVER (PARTITION BY symbol ORDER BY date) as prev_revenue,
    (revenue - LAG(revenue) OVER (PARTITION BY symbol ORDER BY date)) / 
    LAG(revenue) OVER (PARTITION BY symbol ORDER BY date) * 100 as revenue_growth_pct
FROM financial_data.income_statements
WHERE period = 'annual'
ORDER BY symbol, date DESC;
```

## Notes
- All financial values are stored in their original units (usually USD)
- Dates are stored as TIMESTAMP or DATE types
- Ratios and percentages are stored as DECIMAL values
- Use ON CONFLICT clauses for upsert operations to handle data updates
- Implement proper error handling and rate limiting in production