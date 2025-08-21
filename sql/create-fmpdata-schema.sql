-- FMP Data Database Schema
-- All tables for Financial Modeling Prep API data

-- Create schema
-- Create FMP schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS fmp;

-- Set search path
SET search_path TO fmp;

-- =====================================================
-- Core Company Data
-- =====================================================

-- Companies (main company profile)
CREATE TABLE IF NOT EXISTS companies (
    symbol VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255),
    exchange VARCHAR(50),
    exchange_short_name VARCHAR(20),
    sector VARCHAR(100),
    industry VARCHAR(100),
    country VARCHAR(100),
    market_cap BIGINT,
    employees INTEGER,
    website VARCHAR(255),
    description TEXT,
    ceo VARCHAR(255),
    ipo_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Company Executives
CREATE TABLE IF NOT EXISTS executives (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    name VARCHAR(255),
    title VARCHAR(255),
    year_born INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Stock Price Data
-- =====================================================

-- Historical Stock Prices (daily)
CREATE TABLE IF NOT EXISTS stock_prices (
    symbol VARCHAR(10) NOT NULL,
    date TIMESTAMP NOT NULL,
    open DECIMAL(12, 4),
    high DECIMAL(12, 4),
    low DECIMAL(12, 4),
    close DECIMAL(12, 4),
    adj_close DECIMAL(12, 4),
    volume BIGINT,
    unadjusted_volume BIGINT,
    change DECIMAL(12, 4),
    change_percent DECIMAL(8, 4),
    vwap DECIMAL(12, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Real-time Quotes
CREATE TABLE IF NOT EXISTS real_time_quotes (
    symbol VARCHAR(10) PRIMARY KEY,
    price DECIMAL(12, 4),
    change_percentage DECIMAL(8, 4),
    change DECIMAL(12, 4),
    day_low DECIMAL(12, 4),
    day_high DECIMAL(12, 4),
    year_high DECIMAL(12, 4),
    year_low DECIMAL(12, 4),
    market_cap BIGINT,
    price_avg_50 DECIMAL(12, 4),
    price_avg_200 DECIMAL(12, 4),
    volume BIGINT,
    avg_volume BIGINT,
    exchange VARCHAR(50),
    open DECIMAL(12, 4),
    previous_close DECIMAL(12, 4),
    eps DECIMAL(10, 4),
    pe DECIMAL(10, 4),
    earnings_announcement TIMESTAMP,
    shares_outstanding BIGINT,
    timestamp TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Intraday Prices
CREATE TABLE IF NOT EXISTS intraday_prices (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date TIMESTAMP NOT NULL,
    open DECIMAL(12, 4),
    high DECIMAL(12, 4),
    low DECIMAL(12, 4),
    close DECIMAL(12, 4),
    volume BIGINT,
    interval VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, interval),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Financial Statements
-- =====================================================

-- Income Statements
CREATE TABLE IF NOT EXISTS income_statements (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    revenue BIGINT,
    cost_of_revenue BIGINT,
    gross_profit BIGINT,
    gross_profit_ratio DECIMAL(8, 4),
    research_and_development_expenses BIGINT,
    general_and_administrative_expenses BIGINT,
    selling_and_marketing_expenses BIGINT,
    operating_expenses BIGINT,
    cost_and_expenses BIGINT,
    interest_expense BIGINT,
    depreciation_and_amortization BIGINT,
    ebitda BIGINT,
    ebitda_ratio DECIMAL(8, 4),
    operating_income BIGINT,
    operating_income_ratio DECIMAL(8, 4),
    total_other_income_expenses_net BIGINT,
    income_before_tax BIGINT,
    income_before_tax_ratio DECIMAL(8, 4),
    income_tax_expense BIGINT,
    net_income BIGINT,
    net_income_ratio DECIMAL(8, 4),
    eps DECIMAL(10, 4),
    eps_diluted DECIMAL(10, 4),
    weighted_average_shares_outstanding BIGINT,
    weighted_average_shares_outstanding_diluted BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, period),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Balance Sheets
CREATE TABLE IF NOT EXISTS balance_sheets (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    cash_and_cash_equivalents BIGINT,
    short_term_investments BIGINT,
    cash_and_short_term_investments BIGINT,
    net_receivables BIGINT,
    inventory BIGINT,
    other_current_assets BIGINT,
    total_current_assets BIGINT,
    property_plant_equipment_net BIGINT,
    goodwill BIGINT,
    intangible_assets BIGINT,
    long_term_investments BIGINT,
    tax_assets BIGINT,
    other_non_current_assets BIGINT,
    total_non_current_assets BIGINT,
    total_assets BIGINT,
    accounts_payables BIGINT,
    short_term_debt BIGINT,
    tax_payables BIGINT,
    deferred_revenue BIGINT,
    other_current_liabilities BIGINT,
    total_current_liabilities BIGINT,
    long_term_debt BIGINT,
    deferred_revenue_non_current BIGINT,
    deferred_tax_liabilities_non_current BIGINT,
    other_non_current_liabilities BIGINT,
    total_non_current_liabilities BIGINT,
    total_liabilities BIGINT,
    common_stock BIGINT,
    retained_earnings BIGINT,
    accumulated_other_comprehensive_income_loss BIGINT,
    total_stockholders_equity BIGINT,
    total_liabilities_and_stockholders_equity BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, period),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Cash Flow Statements
CREATE TABLE IF NOT EXISTS cash_flow_statements (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    net_income BIGINT,
    depreciation_and_amortization BIGINT,
    deferred_income_tax BIGINT,
    stock_based_compensation BIGINT,
    change_in_working_capital BIGINT,
    accounts_receivables BIGINT,
    inventory BIGINT,
    accounts_payables BIGINT,
    other_working_capital BIGINT,
    other_non_cash_items BIGINT,
    net_cash_provided_by_operating_activities BIGINT,
    investments_in_property_plant_and_equipment BIGINT,
    acquisitions_net BIGINT,
    purchases_of_investments BIGINT,
    sales_maturities_of_investments BIGINT,
    other_investing_activities BIGINT,
    net_cash_used_for_investing_activities BIGINT,
    debt_repayment BIGINT,
    common_stock_issued BIGINT,
    common_stock_repurchased BIGINT,
    dividends_paid BIGINT,
    other_financing_activities BIGINT,
    net_cash_used_provided_by_financing_activities BIGINT,
    net_change_in_cash BIGINT,
    cash_at_beginning_of_period BIGINT,
    cash_at_end_of_period BIGINT,
    free_cash_flow BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, period),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Financial Metrics & Ratios
-- =====================================================

-- Key Metrics
CREATE TABLE IF NOT EXISTS key_metrics (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    revenue_per_share DECIMAL(12, 4),
    net_income_per_share DECIMAL(12, 4),
    operating_cash_flow_per_share DECIMAL(12, 4),
    free_cash_flow_per_share DECIMAL(12, 4),
    cash_per_share DECIMAL(12, 4),
    book_value_per_share DECIMAL(12, 4),
    tangible_book_value_per_share DECIMAL(12, 4),
    shareholders_equity_per_share DECIMAL(12, 4),
    interest_debt_per_share DECIMAL(12, 4),
    market_cap BIGINT,
    enterprise_value BIGINT,
    pe_ratio DECIMAL(12, 4),
    price_to_sales_ratio DECIMAL(12, 4),
    pocfratio DECIMAL(12, 4),
    pfcf_ratio DECIMAL(12, 4),
    pb_ratio DECIMAL(12, 4),
    ptb_ratio DECIMAL(12, 4),
    ev_to_sales DECIMAL(12, 4),
    enterprise_value_over_ebitda DECIMAL(12, 4),
    ev_to_operating_cash_flow DECIMAL(12, 4),
    ev_to_free_cash_flow DECIMAL(12, 4),
    earnings_yield DECIMAL(12, 4),
    free_cash_flow_yield DECIMAL(12, 4),
    debt_to_equity DECIMAL(12, 4),
    debt_to_assets DECIMAL(12, 4),
    net_debt_to_ebitda DECIMAL(12, 4),
    current_ratio DECIMAL(12, 4),
    interest_coverage DECIMAL(12, 4),
    income_quality DECIMAL(12, 4),
    dividend_yield DECIMAL(12, 4),
    payout_ratio DECIMAL(12, 4),
    return_on_assets DECIMAL(12, 4),
    return_on_equity DECIMAL(12, 4),
    gross_profit_margin DECIMAL(12, 4),
    operating_profit_margin DECIMAL(12, 4),
    net_profit_margin DECIMAL(12, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, period),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Financial Ratios
CREATE TABLE IF NOT EXISTS financial_ratios (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    current_ratio DECIMAL(12, 4),
    quick_ratio DECIMAL(12, 4),
    cash_ratio DECIMAL(12, 4),
    days_of_sales_outstanding DECIMAL(12, 4),
    days_of_inventory_outstanding DECIMAL(12, 4),
    operating_cycle DECIMAL(12, 4),
    days_of_payables_outstanding DECIMAL(12, 4),
    cash_conversion_cycle DECIMAL(12, 4),
    gross_profit_margin DECIMAL(12, 4),
    operating_profit_margin DECIMAL(12, 4),
    pretax_profit_margin DECIMAL(12, 4),
    net_profit_margin DECIMAL(12, 4),
    effective_tax_rate DECIMAL(12, 4),
    return_on_assets DECIMAL(12, 4),
    return_on_equity DECIMAL(12, 4),
    return_on_capital_employed DECIMAL(12, 4),
    net_income_per_ebt DECIMAL(12, 4),
    ebt_per_ebit DECIMAL(12, 4),
    ebit_per_revenue DECIMAL(12, 4),
    debt_ratio DECIMAL(12, 4),
    debt_equity_ratio DECIMAL(12, 4),
    long_term_debt_to_capitalization DECIMAL(12, 4),
    total_debt_to_capitalization DECIMAL(12, 4),
    interest_coverage DECIMAL(12, 4),
    cash_flow_to_debt_ratio DECIMAL(12, 4),
    company_equity_multiplier DECIMAL(12, 4),
    receivables_turnover DECIMAL(12, 4),
    payables_turnover DECIMAL(12, 4),
    inventory_turnover DECIMAL(12, 4),
    fixed_asset_turnover DECIMAL(12, 4),
    asset_turnover DECIMAL(12, 4),
    operating_cash_flow_per_share DECIMAL(12, 4),
    free_cash_flow_per_share DECIMAL(12, 4),
    cash_per_share DECIMAL(12, 4),
    payout_ratio DECIMAL(12, 4),
    operating_cash_flow_sales_ratio DECIMAL(12, 4),
    free_cash_flow_operating_cash_flow_ratio DECIMAL(12, 4),
    cash_flow_coverage_ratios DECIMAL(12, 4),
    short_term_coverage_ratios DECIMAL(12, 4),
    capital_expenditure_coverage_ratio DECIMAL(12, 4),
    dividend_paid_and_capex_coverage_ratio DECIMAL(12, 4),
    dividend_payout_ratio DECIMAL(12, 4),
    price_book_value_ratio DECIMAL(12, 4),
    price_to_book_ratio DECIMAL(12, 4),
    price_to_sales_ratio DECIMAL(12, 4),
    price_earnings_ratio DECIMAL(12, 4),
    price_to_free_cash_flows_ratio DECIMAL(12, 4),
    price_to_operating_cash_flows_ratio DECIMAL(12, 4),
    price_cash_flow_ratio DECIMAL(12, 4),
    price_earnings_to_growth_ratio DECIMAL(12, 4),
    price_sales_ratio DECIMAL(12, 4),
    dividend_yield DECIMAL(12, 4),
    enterprise_value_multiple DECIMAL(12, 4),
    price_fair_value DECIMAL(12, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, period),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Financial Growth
CREATE TABLE IF NOT EXISTS financial_growth (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    revenue_growth DECIMAL(12, 4),
    gross_profit_growth DECIMAL(12, 4),
    ebitda_growth DECIMAL(12, 4),
    operating_income_growth DECIMAL(12, 4),
    net_income_growth DECIMAL(12, 4),
    eps_growth DECIMAL(12, 4),
    eps_diluted_growth DECIMAL(12, 4),
    weighted_average_shares_growth DECIMAL(12, 4),
    weighted_average_shares_diluted_growth DECIMAL(12, 4),
    dividends_per_share_growth DECIMAL(12, 4),
    operating_cash_flow_growth DECIMAL(12, 4),
    free_cash_flow_growth DECIMAL(12, 4),
    receivables_growth DECIMAL(12, 4),
    inventory_growth DECIMAL(12, 4),
    asset_growth DECIMAL(12, 4),
    book_value_per_share_growth DECIMAL(12, 4),
    debt_growth DECIMAL(12, 4),
    rd_expense_growth DECIMAL(12, 4),
    sga_expenses_growth DECIMAL(12, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, period),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Enterprise Values
CREATE TABLE IF NOT EXISTS enterprise_values (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    stock_price DECIMAL(12, 4),
    number_of_shares BIGINT,
    market_capitalization BIGINT,
    minus_cash_and_cash_equivalents BIGINT,
    add_total_debt BIGINT,
    enterprise_value BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Corporate Actions
-- =====================================================

-- Dividends
CREATE TABLE IF NOT EXISTS dividends (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    label VARCHAR(100),
    adj_dividend DECIMAL(10, 4),
    dividend DECIMAL(10, 4),
    record_date DATE,
    payment_date DATE,
    declaration_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Stock Splits
CREATE TABLE IF NOT EXISTS stock_splits (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    label VARCHAR(100),
    numerator INTEGER,
    denominator INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Analyst Data
-- =====================================================

-- Analyst Estimates
CREATE TABLE IF NOT EXISTS analyst_estimates (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    estimated_revenue_low BIGINT,
    estimated_revenue_high BIGINT,
    estimated_revenue_avg BIGINT,
    estimated_ebitda_low BIGINT,
    estimated_ebitda_high BIGINT,
    estimated_ebitda_avg BIGINT,
    estimated_ebit_low BIGINT,
    estimated_ebit_high BIGINT,
    estimated_ebit_avg BIGINT,
    estimated_net_income_low BIGINT,
    estimated_net_income_high BIGINT,
    estimated_net_income_avg BIGINT,
    estimated_sga_expense_low BIGINT,
    estimated_sga_expense_high BIGINT,
    estimated_sga_expense_avg BIGINT,
    estimated_eps_low DECIMAL(10, 4),
    estimated_eps_high DECIMAL(10, 4),
    estimated_eps_avg DECIMAL(10, 4),
    number_analyst_estimated_revenue INTEGER,
    number_analysts_estimated_eps INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Price Targets
CREATE TABLE IF NOT EXISTS price_targets (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    published_date DATE,
    news_url VARCHAR(500),
    news_title TEXT,
    analyst_name VARCHAR(255),
    analyst_company VARCHAR(255),
    price_target DECIMAL(12, 4),
    adj_price_target DECIMAL(12, 4),
    price_when_posted DECIMAL(12, 4),
    news_publisher VARCHAR(255),
    news_base_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Stock Grades
CREATE TABLE IF NOT EXISTS stock_grades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    grading_company VARCHAR(255),
    previous_grade VARCHAR(50),
    new_grade VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Earnings Surprises
CREATE TABLE IF NOT EXISTS earnings_surprises (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    actual_earnings_per_share DECIMAL(10, 4),
    estimated_earnings DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Institutional & Insider Data
-- =====================================================

-- Institutional Holders
CREATE TABLE IF NOT EXISTS institutional_holders (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    holder VARCHAR(255),
    shares BIGINT,
    date_reported DATE,
    change BIGINT,
    change_percentage DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Insider Trading
CREATE TABLE IF NOT EXISTS insider_trading (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    filing_date DATE,
    transaction_date DATE,
    reporter_name VARCHAR(255),
    reporter_title VARCHAR(255),
    transaction_type VARCHAR(50),
    securities_owned BIGINT,
    securities_transacted BIGINT,
    price DECIMAL(12, 4),
    security_name VARCHAR(255),
    link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- SEC Filings
CREATE TABLE IF NOT EXISTS sec_filings (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    filing_date DATE,
    accepted_date TIMESTAMP,
    cik VARCHAR(20),
    type VARCHAR(20),
    link VARCHAR(500),
    final_link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- News & Sentiment
-- =====================================================

-- News
CREATE TABLE IF NOT EXISTS news (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10),
    published_date TIMESTAMP NOT NULL,
    title TEXT,
    image VARCHAR(500),
    site VARCHAR(255),
    text TEXT,
    url VARCHAR(500) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Press Releases
CREATE TABLE IF NOT EXISTS press_releases (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date TIMESTAMP,
    title TEXT,
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Social Sentiment
CREATE TABLE IF NOT EXISTS social_sentiment (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    positive_mentions INTEGER,
    negative_mentions INTEGER,
    neutral_mentions INTEGER,
    total_mentions INTEGER,
    sentiment_score DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Calendar Data
-- =====================================================

-- Earnings Calendar
CREATE TABLE IF NOT EXISTS earnings_calendar (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    eps DECIMAL(12, 4),
    eps_estimated DECIMAL(12, 4),
    time VARCHAR(10),
    revenue BIGINT,
    revenue_estimated BIGINT,
    fiscal_date_ending DATE,
    updated_from_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- IPO Calendar
CREATE TABLE IF NOT EXISTS ipo_calendar (
    id SERIAL PRIMARY KEY,
    date DATE,
    company VARCHAR(255),
    symbol VARCHAR(10),
    exchange VARCHAR(50),
    actions VARCHAR(50),
    shares BIGINT,
    price_range VARCHAR(50),
    market_cap BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Split Calendar
CREATE TABLE IF NOT EXISTS split_calendar (
    id SERIAL PRIMARY KEY,
    date DATE,
    label VARCHAR(100),
    symbol VARCHAR(10),
    numerator INTEGER,
    denominator INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Dividend Calendar
CREATE TABLE IF NOT EXISTS dividend_calendar (
    id SERIAL PRIMARY KEY,
    date DATE,
    label VARCHAR(100),
    symbol VARCHAR(10),
    dividend DECIMAL(10, 4),
    adj_dividend DECIMAL(10, 4),
    declaration_date DATE,
    record_date DATE,
    payment_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- Economic Calendar
CREATE TABLE IF NOT EXISTS economic_calendar (
    id SERIAL PRIMARY KEY,
    event VARCHAR(255),
    date TIMESTAMP,
    country VARCHAR(100),
    actual DECIMAL(20, 4),
    previous DECIMAL(20, 4),
    change DECIMAL(20, 4),
    change_percentage DECIMAL(8, 4),
    estimate DECIMAL(20, 4),
    impact VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- ETF Data
-- =====================================================

-- ETF Holdings
CREATE TABLE IF NOT EXISTS etf_holdings (
    id SERIAL PRIMARY KEY,
    etf_symbol VARCHAR(10) NOT NULL,
    asset VARCHAR(255),
    shares_number BIGINT,
    weight_percentage DECIMAL(8, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETF Sector Weights
CREATE TABLE IF NOT EXISTS etf_sector_weights (
    id SERIAL PRIMARY KEY,
    etf_symbol VARCHAR(10) NOT NULL,
    sector VARCHAR(100),
    weight_percentage DECIMAL(8, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETF Country Weights
CREATE TABLE IF NOT EXISTS etf_country_weights (
    id SERIAL PRIMARY KEY,
    etf_symbol VARCHAR(10) NOT NULL,
    country VARCHAR(100),
    weight_percentage DECIMAL(8, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Market Indexes
-- =====================================================

-- Market Indexes
CREATE TABLE IF NOT EXISTS market_indexes (
    symbol VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(12, 4),
    change_percentage DECIMAL(8, 4),
    change DECIMAL(12, 4),
    day_low DECIMAL(12, 4),
    day_high DECIMAL(12, 4),
    year_high DECIMAL(12, 4),
    year_low DECIMAL(12, 4),
    volume BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index Historical Prices
CREATE TABLE IF NOT EXISTS index_prices (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(12, 4),
    high DECIMAL(12, 4),
    low DECIMAL(12, 4),
    close DECIMAL(12, 4),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- =====================================================
-- Economic Indicators
-- =====================================================

-- Economic Indicators
CREATE TABLE IF NOT EXISTS economic_indicators (
    id SERIAL PRIMARY KEY,
    indicator_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(20, 4),
    unit VARCHAR(50),
    country VARCHAR(100),
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(indicator_name, date, country)
);

-- Treasury Rates
CREATE TABLE IF NOT EXISTS treasury_rates (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    month_1 DECIMAL(8, 4),
    month_2 DECIMAL(8, 4),
    month_3 DECIMAL(8, 4),
    month_6 DECIMAL(8, 4),
    year_1 DECIMAL(8, 4),
    year_2 DECIMAL(8, 4),
    year_3 DECIMAL(8, 4),
    year_5 DECIMAL(8, 4),
    year_7 DECIMAL(8, 4),
    year_10 DECIMAL(8, 4),
    year_20 DECIMAL(8, 4),
    year_30 DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date)
);

-- =====================================================
-- Alternative Assets
-- =====================================================

-- Cryptocurrency Quotes
CREATE TABLE IF NOT EXISTS crypto_quotes (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(20, 8),
    change_percentage_24h DECIMAL(8, 4),
    change_24h DECIMAL(20, 8),
    market_cap BIGINT,
    volume_24h BIGINT,
    circulating_supply BIGINT,
    total_supply BIGINT,
    max_supply BIGINT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cryptocurrency Historical Prices
CREATE TABLE IF NOT EXISTS crypto_prices (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    date TIMESTAMP NOT NULL,
    open DECIMAL(20, 8),
    high DECIMAL(20, 8),
    low DECIMAL(20, 8),
    close DECIMAL(20, 8),
    volume BIGINT,
    market_cap BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- Forex Quotes
CREATE TABLE IF NOT EXISTS forex_quotes (
    ticker VARCHAR(10) PRIMARY KEY,
    bid DECIMAL(20, 8),
    ask DECIMAL(20, 8),
    open DECIMAL(20, 8),
    low DECIMAL(20, 8),
    high DECIMAL(20, 8),
    changes DECIMAL(20, 8),
    date TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Forex Historical Prices
CREATE TABLE IF NOT EXISTS forex_prices (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(20, 8),
    high DECIMAL(20, 8),
    low DECIMAL(20, 8),
    close DECIMAL(20, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticker, date)
);

-- Commodity Quotes
CREATE TABLE IF NOT EXISTS commodity_quotes (
    symbol VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100),
    price DECIMAL(20, 8),
    change_percentage DECIMAL(8, 4),
    change DECIMAL(20, 8),
    day_low DECIMAL(20, 8),
    day_high DECIMAL(20, 8),
    year_low DECIMAL(20, 8),
    year_high DECIMAL(20, 8),
    market_cap BIGINT,
    volume BIGINT,
    avg_volume BIGINT,
    open DECIMAL(20, 8),
    previous_close DECIMAL(20, 8),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commodity Historical Prices
CREATE TABLE IF NOT EXISTS commodity_prices (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(20, 8),
    high DECIMAL(20, 8),
    low DECIMAL(20, 8),
    close DECIMAL(20, 8),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- =====================================================
-- Support Tables
-- =====================================================

-- Symbols List
CREATE TABLE IF NOT EXISTS symbols_list (
    symbol VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(12, 4),
    exchange VARCHAR(50),
    exchange_short_name VARCHAR(20),
    type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Create Indexes for Performance
-- =====================================================

-- Companies indexes
CREATE INDEX idx_companies_sector ON companies(sector);
CREATE INDEX idx_companies_industry ON companies(industry);
CREATE INDEX idx_companies_country ON companies(country);

-- Stock prices indexes
CREATE INDEX idx_stock_prices_symbol ON stock_prices(symbol);
CREATE INDEX idx_stock_prices_date ON stock_prices(date);
CREATE INDEX idx_stock_prices_symbol_date ON stock_prices(symbol, date);

-- Financial statements indexes
CREATE INDEX idx_income_statements_symbol_date ON income_statements(symbol, date);
CREATE INDEX idx_balance_sheets_symbol_date ON balance_sheets(symbol, date);
CREATE INDEX idx_cash_flow_statements_symbol_date ON cash_flow_statements(symbol, date);

-- Metrics indexes
CREATE INDEX idx_key_metrics_symbol_date ON key_metrics(symbol, date);
CREATE INDEX idx_financial_ratios_symbol_date ON financial_ratios(symbol, date);
CREATE INDEX idx_financial_growth_symbol_date ON financial_growth(symbol, date);
CREATE INDEX idx_enterprise_values_symbol_date ON enterprise_values(symbol, date);

-- Corporate actions indexes
CREATE INDEX idx_dividends_symbol_date ON dividends(symbol, date);
CREATE INDEX idx_stock_splits_symbol_date ON stock_splits(symbol, date);

-- Analyst data indexes
CREATE INDEX idx_analyst_estimates_symbol_date ON analyst_estimates(symbol, date);
CREATE INDEX idx_price_targets_symbol ON price_targets(symbol);
CREATE INDEX idx_stock_grades_symbol ON stock_grades(symbol);
CREATE INDEX idx_earnings_surprises_symbol_date ON earnings_surprises(symbol, date);

-- Institutional/Insider indexes
CREATE INDEX idx_institutional_holders_symbol ON institutional_holders(symbol);
CREATE INDEX idx_insider_trading_symbol ON insider_trading(symbol);
CREATE INDEX idx_insider_trading_transaction_date ON insider_trading(transaction_date);
CREATE INDEX idx_sec_filings_symbol ON sec_filings(symbol);
CREATE INDEX idx_sec_filings_type ON sec_filings(type);

-- News indexes
CREATE INDEX idx_news_symbol ON news(symbol);
CREATE INDEX idx_news_published_date ON news(published_date);
CREATE INDEX idx_press_releases_symbol ON press_releases(symbol);
CREATE INDEX idx_social_sentiment_symbol_date ON social_sentiment(symbol, date);

-- Calendar indexes
CREATE INDEX idx_earnings_calendar_date ON earnings_calendar(date);
CREATE INDEX idx_ipo_calendar_date ON ipo_calendar(date);
CREATE INDEX idx_economic_calendar_date ON economic_calendar(date);

-- ETF indexes
CREATE INDEX idx_etf_holdings_etf_symbol ON etf_holdings(etf_symbol);

-- Market indexes
CREATE INDEX idx_index_prices_symbol_date ON index_prices(symbol, date);

-- Economic indicators indexes
CREATE INDEX idx_economic_indicators_indicator_date ON economic_indicators(indicator_name, date);
CREATE INDEX idx_treasury_rates_date ON treasury_rates(date);

-- Alternative assets indexes
CREATE INDEX idx_crypto_prices_symbol_date ON crypto_prices(symbol, date);
CREATE INDEX idx_forex_prices_ticker_date ON forex_prices(ticker, date);
CREATE INDEX idx_commodity_prices_symbol_date ON commodity_prices(symbol, date);

-- Intraday prices indexes
CREATE INDEX idx_intraday_prices_symbol_date ON intraday_prices(symbol, date);

-- =====================================================
-- Grant Permissions (adjust as needed)
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA fmp TO PUBLIC;

-- Grant permissions on tables (adjust based on your needs)
GRANT SELECT ON ALL TABLES IN SCHEMA fmp TO PUBLIC;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA fmp TO PUBLIC;