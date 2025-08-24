# FMP Database Complete Documentation

## Database Overview
- **Database Name**: fmpdata
- **Schema**: fmp
- **Total Tables**: 77
- **Purpose**: Comprehensive financial data warehouse for Financial Modeling Prep API data

## Complete Table List with Details

### 1. analyst_estimates
- **Columns**: 24
- **Purpose**: Store analyst consensus estimates for companies
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, estimated_revenue_avg, estimated_eps_avg, number_analysts_estimated_eps
- **API Endpoint**: /analyst-estimates

### 2. balance_sheets
- **Columns**: 37
- **Purpose**: Company balance sheet statements
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, date, period, total_assets, total_liabilities, total_stockholders_equity
- **API Endpoint**: /balance-sheet-statement

### 3. bankruptcies
- **Columns**: 12
- **Purpose**: Corporate bankruptcy filings and announcements
- **Update Frequency**: Daily
- **Key Columns**: symbol, company_name, filing_date, chapter, assets_value, liabilities_value
- **API Endpoint**: /bankruptcies-rss-feed

### 4. bond_prices
- **Columns**: 10
- **Purpose**: Historical bond price data
- **Update Frequency**: Daily
- **Key Columns**: cusip, date, price, yield, spread, duration, volume
- **API Endpoint**: /historical-price-full/bond

### 5. bonds
- **Columns**: 16
- **Purpose**: Bond information and specifications
- **Update Frequency**: Weekly
- **Key Columns**: cusip, isin, symbol, issuer_name, bond_type, maturity_date, coupon_rate
- **API Endpoint**: /bonds-list

### 6. cash_flow_statements
- **Columns**: 32
- **Purpose**: Company cash flow statements
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, date, period, net_cash_provided_by_operating_activities, free_cash_flow
- **API Endpoint**: /cash-flow-statement

### 7. commodity_prices
- **Columns**: 9
- **Purpose**: Historical commodity price data
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, open, high, low, close, volume
- **API Endpoint**: /historical-price-full/commodity

### 8. commodity_quotes
- **Columns**: 15
- **Purpose**: Real-time commodity quotes
- **Update Frequency**: Real-time
- **Key Columns**: symbol, name, price, change_percentage, volume, avg_volume
- **API Endpoint**: /quote/commodity

### 9. companies
- **Columns**: 15
- **Purpose**: Company profiles and basic information
- **Update Frequency**: Daily
- **Key Columns**: symbol, name, exchange, sector, industry, country, market_cap, description
- **API Endpoint**: /profile

### 10. company_outlook
- **Columns**: 10
- **Purpose**: Comprehensive company overview
- **Update Frequency**: Daily
- **Key Columns**: symbol, rating, rating_details, insider_transactions, key_executives
- **API Endpoint**: /company-outlook

### 11. comparable_valuations
- **Columns**: 13
- **Purpose**: Peer company valuation comparisons
- **Update Frequency**: Daily
- **Key Columns**: symbol, peer_symbol, peer_pe_ratio, peer_peg_ratio, peer_pb_ratio
- **API Endpoint**: /comparable-company-analysis

### 12. cot_reports
- **Columns**: 17
- **Purpose**: Commitment of Traders reports
- **Update Frequency**: Weekly
- **Key Columns**: symbol, report_date, long_positions, short_positions, net_positions
- **API Endpoint**: /cot-report

### 13. crypto_prices
- **Columns**: 9
- **Purpose**: Historical cryptocurrency price data
- **Update Frequency**: Hourly
- **Key Columns**: symbol, date, open, high, low, close, volume
- **API Endpoint**: /historical-price-full/crypto

### 14. crypto_quotes
- **Columns**: 15
- **Purpose**: Real-time cryptocurrency quotes
- **Update Frequency**: Real-time
- **Key Columns**: symbol, name, price, change_percentage, market_cap, volume
- **API Endpoint**: /quote/crypto

### 15. dcf_models
- **Columns**: 14
- **Purpose**: Discounted cash flow valuation models
- **Update Frequency**: Daily
- **Key Columns**: symbol, dcf_value, stock_price, upside_potential, assumptions
- **API Endpoint**: /discounted-cash-flow

### 16. delistings
- **Columns**: 10
- **Purpose**: Stock delisting announcements
- **Update Frequency**: Daily
- **Key Columns**: symbol, company_name, delisting_date, exchange, reason
- **API Endpoint**: /delisted-companies

### 17. dividend_calendar
- **Columns**: 10
- **Purpose**: Upcoming dividend payment dates
- **Update Frequency**: Daily
- **Key Columns**: symbol, ex_dividend_date, record_date, payment_date, dividend_amount
- **API Endpoint**: /stock_dividend_calendar

### 18. dividends
- **Columns**: 9
- **Purpose**: Historical dividend payment data
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, dividend, adjusted_dividend, record_date, payment_date
- **API Endpoint**: /historical-price-full/stock_dividend

### 19. earnings_calendar
- **Columns**: 9
- **Purpose**: Upcoming earnings announcement dates
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, eps_estimate, revenue_estimate, fiscal_date_ending
- **API Endpoint**: /earning_calendar

### 20. earnings_surprises
- **Columns**: 10
- **Purpose**: Earnings actual vs estimate data
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, date, actual_earnings, estimated_earnings, surprise_percentage
- **API Endpoint**: /earnings-surprises

### 21. earnings_transcripts
- **Columns**: 7
- **Purpose**: Earnings call transcripts
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, quarter, year, date, content, participants
- **API Endpoint**: /earning_call_transcript

### 22. economic_calendar
- **Columns**: 11
- **Purpose**: Economic data release schedule
- **Update Frequency**: Daily
- **Key Columns**: event, date, country, actual, previous, consensus, importance
- **API Endpoint**: /economic_calendar

### 23. economic_indicators
- **Columns**: 7
- **Purpose**: Key economic indicator values
- **Update Frequency**: Daily
- **Key Columns**: indicator, date, value, country, period, unit
- **API Endpoint**: /economic

### 24. economic_indicators_detailed
- **Columns**: 11
- **Purpose**: Detailed economic metrics
- **Update Frequency**: Daily
- **Key Columns**: indicator_name, country, date, value, previous_value, forecast
- **API Endpoint**: /economic-indicator

### 25. employee_count_history
- **Columns**: 7
- **Purpose**: Historical employee count data
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, period_date, employee_count, change_percentage
- **API Endpoint**: /employee-count

### 26. enterprise_values
- **Columns**: 18
- **Purpose**: Company enterprise value calculations
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, market_capitalization, enterprise_value, ev_to_revenue
- **API Endpoint**: /enterprise-values

### 27. esg_benchmarks
- **Columns**: 11
- **Purpose**: ESG benchmark scores by sector
- **Update Frequency**: Monthly
- **Key Columns**: sector, year, avg_environment_score, avg_social_score, avg_governance_score
- **API Endpoint**: /esg-benchmarks

### 28. esg_scores
- **Columns**: 11
- **Purpose**: Environmental Social Governance scores
- **Update Frequency**: Monthly
- **Key Columns**: symbol, environment_score, social_score, governance_score, total_esg_score
- **API Endpoint**: /esg-environmental-social-governance-data

### 29. etf_country_weights
- **Columns**: 5
- **Purpose**: ETF geographic allocation
- **Update Frequency**: Daily
- **Key Columns**: symbol, country, weight_percentage, updated_at
- **API Endpoint**: /etf-country-weightings

### 30. etf_holdings
- **Columns**: 8
- **Purpose**: ETF portfolio holdings
- **Update Frequency**: Daily
- **Key Columns**: etf_symbol, asset, shares, weight, market_value, updated_at
- **API Endpoint**: /etf-holder

### 31. etf_sector_weights
- **Columns**: 5
- **Purpose**: ETF sector allocation
- **Update Frequency**: Daily
- **Key Columns**: symbol, sector, weight_percentage, updated_at
- **API Endpoint**: /etf-sector-weightings

### 32. executives
- **Columns**: 8
- **Purpose**: Company executive information
- **Update Frequency**: Monthly
- **Key Columns**: symbol, name, title, pay, gender, year_born, tenure_years
- **API Endpoint**: /key-executives

### 33. financial_growth
- **Columns**: 29
- **Purpose**: Financial growth metrics
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, date, revenue_growth, earnings_growth, dividend_growth
- **API Endpoint**: /financial-growth

### 34. financial_ratios
- **Columns**: 59
- **Purpose**: Financial ratio calculations
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, pe_ratio, peg_ratio, pb_ratio, roe, roa
- **API Endpoint**: /ratios

### 35. forex_prices
- **Columns**: 9
- **Purpose**: Historical foreign exchange rates
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, open, high, low, close, volume
- **API Endpoint**: /historical-price-full/forex

### 36. forex_quotes
- **Columns**: 14
- **Purpose**: Real-time forex quotes
- **Update Frequency**: Real-time
- **Key Columns**: symbol, price, bid, ask, change_percentage, volume
- **API Endpoint**: /quote/forex

### 37. gdp_data
- **Columns**: 8
- **Purpose**: GDP data by country
- **Update Frequency**: Quarterly
- **Key Columns**: country, date, gdp_value, gdp_growth, gdp_per_capita
- **API Endpoint**: /gdp

### 38. geographic_revenue
- **Columns**: 9
- **Purpose**: Revenue breakdown by geography
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, period, country, revenue, revenue_percentage
- **API Endpoint**: /revenue-geographic-segmentation

### 39. government_contracts
- **Columns**: 10
- **Purpose**: Government contract awards
- **Update Frequency**: Daily
- **Key Columns**: company_name, award_date, agency, contract_value, description
- **API Endpoint**: /government-contracts

### 40. house_trading
- **Columns**: 12
- **Purpose**: House of Representatives trading activity
- **Update Frequency**: Daily
- **Key Columns**: representative, symbol, transaction_date, transaction_type, amount
- **API Endpoint**: /house-trading

### 41. income_statements
- **Columns**: 33
- **Purpose**: Company income statements
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, date, period, revenue, gross_profit, net_income, eps
- **API Endpoint**: /income-statement

### 42. index_prices
- **Columns**: 10
- **Purpose**: Stock market index values
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, open, high, low, close, volume
- **API Endpoint**: /historical-price-full/index

### 43. industry_performance
- **Columns**: 10
- **Purpose**: Industry sector performance metrics
- **Update Frequency**: Daily
- **Key Columns**: industry, date, change_percentage, market_cap, pe_ratio
- **API Endpoint**: /industry-performance

### 44. inflation_data
- **Columns**: 8
- **Purpose**: Inflation rates by country
- **Update Frequency**: Monthly
- **Key Columns**: country, date, inflation_rate, cpi_value, core_inflation
- **API Endpoint**: /inflation

### 45. insider_trading
- **Columns**: 12
- **Purpose**: Insider transaction filings
- **Update Frequency**: Daily
- **Key Columns**: symbol, filing_date, transaction_date, insider_name, transaction_type, shares
- **API Endpoint**: /insider-trading

### 46. institutional_holders
- **Columns**: 10
- **Purpose**: Institutional ownership data
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, holder, shares, date_reported, change, percentage_outstanding
- **API Endpoint**: /institutional-holder

### 47. intraday_prices
- **Columns**: 8
- **Purpose**: Intraday price data
- **Update Frequency**: Real-time
- **Key Columns**: symbol, date, open, high, low, close, volume
- **API Endpoint**: /historical-chart/1min

### 48. ipo_calendar
- **Columns**: 11
- **Purpose**: Initial public offering schedule
- **Update Frequency**: Daily
- **Key Columns**: symbol, company, ipo_date, price_range, shares, exchange
- **API Endpoint**: /ipo_calendar

### 49. key_metrics
- **Columns**: 36
- **Purpose**: Key financial metrics
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, revenue_per_share, net_income_per_share, book_value_per_share
- **API Endpoint**: /key-metrics

### 50. lobbying_data
- **Columns**: 10
- **Purpose**: Corporate lobbying expenditures
- **Update Frequency**: Quarterly
- **Key Columns**: company_name, year, quarter, amount, issues, lobbyists
- **API Endpoint**: /lobbying

### 51. ma_deals
- **Columns**: 13
- **Purpose**: Mergers and acquisitions transactions
- **Update Frequency**: Daily
- **Key Columns**: acquirer, target, announcement_date, transaction_value, status
- **API Endpoint**: /mergers-acquisitions

### 52. market_breadth
- **Columns**: 18
- **Purpose**: Market breadth indicators
- **Update Frequency**: Daily
- **Key Columns**: date, advances, declines, unchanged, advance_decline_ratio
- **API Endpoint**: /market-breadth

### 53. market_holidays
- **Columns**: 9
- **Purpose**: Stock market holiday schedule
- **Update Frequency**: Yearly
- **Key Columns**: date, holiday_name, exchange, is_open, early_close_time
- **API Endpoint**: /market-hours

### 54. market_hours
- **Columns**: 8
- **Purpose**: Market trading hours
- **Update Frequency**: Static
- **Key Columns**: exchange, market_open, market_close, pre_market_open, after_hours_close
- **API Endpoint**: /market-hours

### 55. market_indexes
- **Columns**: 6
- **Purpose**: Global market index list
- **Update Frequency**: Static
- **Key Columns**: symbol, name, exchange, currency, description
- **API Endpoint**: /indexes

### 56. news
- **Columns**: 10
- **Purpose**: Financial news articles
- **Update Frequency**: Real-time
- **Key Columns**: symbol, published_date, title, text, site, url, author
- **API Endpoint**: /stock_news

### 57. news_enhanced
- **Columns**: 15
- **Purpose**: Enhanced news with sentiment analysis
- **Update Frequency**: Real-time
- **Key Columns**: symbol, title, sentiment_score, sentiment_label, relevance_score
- **API Endpoint**: /stock-news-sentiments

### 58. options_chain
- **Columns**: 18
- **Purpose**: Options contract chains
- **Update Frequency**: Daily
- **Key Columns**: symbol, expiration_date, strike_price, option_type, bid, ask, volume
- **API Endpoint**: /option-chain

### 59. options_flow
- **Columns**: 17
- **Purpose**: Options order flow data
- **Update Frequency**: Real-time
- **Key Columns**: symbol, date, option_type, strike, expiration, volume, premium
- **API Endpoint**: /options-flow

### 60. options_greeks
- **Columns**: 12
- **Purpose**: Options Greeks calculations
- **Update Frequency**: Daily
- **Key Columns**: symbol, strike, expiration, delta, gamma, theta, vega
- **API Endpoint**: /option-greeks

### 61. press_releases
- **Columns**: 8
- **Purpose**: Company press releases
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, title, text, url, created_at
- **API Endpoint**: /press-releases

### 62. price_targets
- **Columns**: 11
- **Purpose**: Analyst price targets
- **Update Frequency**: Daily
- **Key Columns**: symbol, analyst_name, price_target, rating, published_date
- **API Endpoint**: /price-target

### 63. real_time_quotes
- **Columns**: 21
- **Purpose**: Real-time stock quotes
- **Update Frequency**: Real-time
- **Key Columns**: symbol, price, change, change_percentage, volume, market_cap
- **API Endpoint**: /quote

### 64. revenue_segments
- **Columns**: 9
- **Purpose**: Revenue by business segment
- **Update Frequency**: Quarterly
- **Key Columns**: symbol, period, segment, revenue, revenue_percentage
- **API Endpoint**: /revenue-product-segmentation

### 65. screener_results
- **Columns**: 7
- **Purpose**: Stock screener results
- **Update Frequency**: Daily
- **Key Columns**: symbol, screen_name, market_cap, sector, volume, pe_ratio
- **API Endpoint**: /stock-screener

### 66. sec_filings
- **Columns**: 10
- **Purpose**: SEC filing documents
- **Update Frequency**: Daily
- **Key Columns**: symbol, type, filing_date, accepted_date, url, period_of_report
- **API Endpoint**: /sec_filings

### 67. sector_performance
- **Columns**: 10
- **Purpose**: Market sector performance
- **Update Frequency**: Daily
- **Key Columns**: sector, date, change_percentage, market_cap, pe_ratio
- **API Endpoint**: /sector-performance

### 68. senate_trading
- **Columns**: 12
- **Purpose**: Senate member trading activity
- **Update Frequency**: Daily
- **Key Columns**: senator, symbol, transaction_date, transaction_type, amount
- **API Endpoint**: /senate-trading

### 69. social_sentiment
- **Columns**: 14
- **Purpose**: Social media sentiment scores
- **Update Frequency**: Hourly
- **Key Columns**: symbol, date, twitter_sentiment, reddit_sentiment, stocktwits_sentiment
- **API Endpoint**: /social-sentiment

### 70. split_calendar
- **Columns**: 8
- **Purpose**: Stock split announcements
- **Update Frequency**: Daily
- **Key Columns**: symbol, split_date, numerator, denominator, ratio
- **API Endpoint**: /stock_split_calendar

### 71. stock_grades
- **Columns**: 11
- **Purpose**: Analyst stock ratings
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, grading_company, previous_grade, new_grade
- **API Endpoint**: /grade

### 72. stock_peers
- **Columns**: 5
- **Purpose**: Peer company lists
- **Update Frequency**: Monthly
- **Key Columns**: symbol, peer_symbol, similarity_score, updated_at
- **API Endpoint**: /stock_peers

### 73. stock_prices
- **Columns**: 14
- **Purpose**: Historical stock price data
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, open, high, low, close, volume, vwap
- **API Endpoint**: /historical-price-full

### 74. stock_splits
- **Columns**: 7
- **Purpose**: Historical stock split data
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, numerator, denominator, split_ratio
- **API Endpoint**: /historical-price-full/stock_split

### 75. symbols_list
- **Columns**: 10
- **Purpose**: Complete symbol directory
- **Update Frequency**: Daily
- **Key Columns**: symbol, name, exchange, exchange_short_name, type, currency
- **API Endpoint**: /stock/list

### 76. technical_indicators
- **Columns**: 15
- **Purpose**: Technical analysis indicators
- **Update Frequency**: Daily
- **Key Columns**: symbol, date, indicator_type, period, value, signal
- **API Endpoint**: /technical_indicator

### 77. treasury_rates
- **Columns**: 13
- **Purpose**: US Treasury yield rates
- **Update Frequency**: Daily
- **Key Columns**: date, month1, month3, year1, year5, year10, year30
- **API Endpoint**: /treasury

## Database Location and Access

### Connection Details
```sql
Host: localhost
Port: 5432
Database: fmpdata
Schema: fmp
User: parthbhatt
```

### Sample Connection String
```
postgresql://parthbhatt@localhost:5432/fmpdata
```

### Access via psql
```bash
psql -U parthbhatt -d fmpdata
\dt fmp.*  # List all tables
```

## Table Categories

### Core Financial Data (20 tables)
- Companies, financial statements, ratios, metrics
- Balance sheets, income statements, cash flow
- Enterprise values, financial growth

### Market Data (15 tables)
- Stock prices, real-time quotes, intraday data
- Index prices, market hours, holidays
- Splits, dividends, IPO calendar

### Alternative Data (12 tables)
- ESG scores and benchmarks
- Senate/House trading
- Government contracts, lobbying
- Social sentiment

### Options & Derivatives (5 tables)
- Options chain, Greeks, flow
- COT reports

### Economic Data (8 tables)
- Economic indicators, GDP, inflation
- Economic calendar, treasury rates
- Commodity and forex data

### News & Analysis (10 tables)
- News, enhanced news with sentiment
- Analyst estimates, price targets
- Earnings transcripts, press releases

### Corporate Actions (7 tables)
- M&A deals, bankruptcies, delistings
- Insider trading, institutional holders
- Executive information

## Update Schedule

### Real-time Updates
- Real-time quotes, options flow, news

### Hourly Updates
- Crypto prices, social sentiment

### Daily Updates
- Stock prices, analyst estimates, most tables

### Weekly Updates
- Bonds, COT reports

### Quarterly Updates
- Financial statements, earnings, segments

### Monthly Updates
- ESG scores, inflation data

## Data Retention
- Historical data: Retained indefinitely
- Real-time data: Latest snapshot only
- News: 90 days rolling window
- Intraday: 30 days detailed, daily aggregates retained

## Scripts and Automation

### Update Scripts Location
```
/Users/parthbhatt/Documents/fmp-data-system/scripts/
- update-all-timeseries-data.ts
- update-complete-fmp-data.ts
- incremental-update.ts
- fmp-cron-update.sh
```

### Cron Jobs
```bash
# Hourly incremental updates
0 * * * * /path/to/fmp-cron-update.sh incremental

# Twice daily extended updates
0 6,18 * * * /path/to/fmp-cron-update.sh extended

# Weekly full update
0 2 * * 0 /path/to/fmp-cron-update.sh full
```

## API Rate Limits
- Maximum: 3000 requests per minute
- Configured safety buffer: 2800 requests per minute
- Batch size: 10 symbols per batch
- Delay between batches: 1 second

## Notes
- All tables include created_at timestamps
- Most tables have updated_at for tracking changes
- Financial values stored as BIGINT (cents) or NUMERIC for precision
- All dates stored in UTC timezone
- Indexes created on commonly queried columns (symbol, date)