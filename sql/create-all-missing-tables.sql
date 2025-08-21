-- FMP Data System - Complete Schema for All Missing Tables
-- This script creates all tables needed for 100% FMP API coverage

-- Set schema
SET search_path TO fmp;

-- =====================================================
-- ESG Data Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS esg_scores (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE,
    environment_score DECIMAL(8, 4),
    social_score DECIMAL(8, 4),
    governance_score DECIMAL(8, 4),
    esg_score DECIMAL(8, 4),
    rating VARCHAR(10),
    controversy_level VARCHAR(20),
    activities_involvement TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS esg_benchmarks (
    id SERIAL PRIMARY KEY,
    sector VARCHAR(100),
    industry VARCHAR(100),
    year INTEGER,
    avg_environment_score DECIMAL(8, 4),
    avg_social_score DECIMAL(8, 4),
    avg_governance_score DECIMAL(8, 4),
    avg_esg_score DECIMAL(8, 4),
    companies_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sector, industry, year)
);

-- =====================================================
-- Technical Indicators Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS technical_indicators (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date TIMESTAMP NOT NULL,
    indicator_type VARCHAR(50) NOT NULL,
    period INTEGER,
    value DECIMAL(20, 8),
    signal_value DECIMAL(20, 8),
    histogram DECIMAL(20, 8),
    upper_band DECIMAL(20, 8),
    middle_band DECIMAL(20, 8),
    lower_band DECIMAL(20, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, indicator_type, period),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE INDEX idx_technical_indicators_lookup ON technical_indicators(symbol, indicator_type, date DESC);

-- =====================================================
-- Options Data Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS options_chain (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    expiration_date DATE NOT NULL,
    strike_price DECIMAL(12, 4) NOT NULL,
    option_type VARCHAR(4) NOT NULL, -- CALL or PUT
    contract_symbol VARCHAR(30),
    bid DECIMAL(12, 4),
    ask DECIMAL(12, 4),
    last_price DECIMAL(12, 4),
    mark DECIMAL(12, 4),
    volume INTEGER,
    open_interest INTEGER,
    implied_volatility DECIMAL(8, 4),
    in_the_money BOOLEAN,
    time_value DECIMAL(12, 4),
    intrinsic_value DECIMAL(12, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, expiration_date, strike_price, option_type),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS options_greeks (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    expiration_date DATE NOT NULL,
    strike_price DECIMAL(12, 4) NOT NULL,
    option_type VARCHAR(4) NOT NULL,
    delta DECIMAL(8, 6),
    gamma DECIMAL(8, 6),
    theta DECIMAL(8, 6),
    vega DECIMAL(8, 6),
    rho DECIMAL(8, 6),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, expiration_date, strike_price, option_type),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS options_flow (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date TIMESTAMP NOT NULL,
    expiration_date DATE,
    strike_price DECIMAL(12, 4),
    option_type VARCHAR(4),
    volume INTEGER,
    open_interest INTEGER,
    premium DECIMAL(15, 2),
    sentiment VARCHAR(20), -- BULLISH, BEARISH, NEUTRAL
    unusual_activity BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE INDEX idx_options_flow_date ON options_flow(date DESC);
CREATE INDEX idx_options_unusual ON options_flow(symbol, unusual_activity) WHERE unusual_activity = true;

-- =====================================================
-- Market Performance Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS sector_performance (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    sector VARCHAR(100) NOT NULL,
    change_percentage DECIMAL(8, 4),
    ytd_return DECIMAL(8, 4),
    one_year_return DECIMAL(8, 4),
    three_year_return DECIMAL(8, 4),
    five_year_return DECIMAL(8, 4),
    volume BIGINT,
    market_cap NUMERIC(20, 2),
    pe_ratio DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, sector)
);

CREATE TABLE IF NOT EXISTS industry_performance (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    industry VARCHAR(200) NOT NULL,
    sector VARCHAR(100),
    change_percentage DECIMAL(8, 4),
    market_cap NUMERIC(20, 2),
    pe_ratio DECIMAL(10, 4),
    companies_count INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, industry)
);

CREATE TABLE IF NOT EXISTS market_hours (
    id SERIAL PRIMARY KEY,
    exchange VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    is_open BOOLEAN,
    pre_market_open TIME,
    market_open TIME,
    market_close TIME,
    post_market_close TIME,
    timezone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exchange, date)
);

CREATE TABLE IF NOT EXISTS market_holidays (
    id SERIAL PRIMARY KEY,
    exchange VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    holiday_name VARCHAR(100),
    is_early_close BOOLEAN,
    close_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exchange, date)
);

-- =====================================================
-- Advanced Economic Data Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS economic_indicators_detailed (
    id SERIAL PRIMARY KEY,
    indicator_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    value DECIMAL(20, 4),
    previous_value DECIMAL(20, 4),
    forecast_value DECIMAL(20, 4),
    actual_vs_forecast DECIMAL(8, 4),
    unit VARCHAR(50),
    country VARCHAR(100),
    importance VARCHAR(20), -- HIGH, MEDIUM, LOW
    source VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(indicator_name, date, country)
);

CREATE TABLE IF NOT EXISTS gdp_data (
    id SERIAL PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    gdp_nominal DECIMAL(20, 2),
    gdp_real DECIMAL(20, 2),
    gdp_growth_rate DECIMAL(8, 4),
    gdp_per_capita DECIMAL(15, 2),
    quarter VARCHAR(10),
    year INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country, date)
);

CREATE TABLE IF NOT EXISTS inflation_data (
    id SERIAL PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    date DATE NOT NULL,
    cpi_value DECIMAL(10, 4),
    cpi_change_percentage DECIMAL(8, 4),
    core_cpi DECIMAL(10, 4),
    core_cpi_change DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country, date)
);

-- =====================================================
-- M&A and Corporate Actions Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS ma_deals (
    id SERIAL PRIMARY KEY,
    acquirer_symbol VARCHAR(10),
    target_symbol VARCHAR(10),
    announcement_date DATE,
    completion_date DATE,
    deal_value NUMERIC(20, 2),
    deal_type VARCHAR(50), -- MERGER, ACQUISITION, etc.
    payment_method VARCHAR(50), -- CASH, STOCK, MIXED
    deal_status VARCHAR(50), -- PENDING, COMPLETED, TERMINATED
    premium_percentage DECIMAL(8, 4),
    synergies_estimate NUMERIC(15, 2),
    regulatory_approvals TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bankruptcies (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10),
    company_name VARCHAR(255),
    filing_date DATE,
    chapter VARCHAR(20), -- Chapter 7, 11, etc.
    assets_value NUMERIC(20, 2),
    liabilities_value NUMERIC(20, 2),
    court VARCHAR(255),
    case_number VARCHAR(100),
    emergence_date DATE,
    outcome VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delistings (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255),
    delisting_date DATE,
    reason VARCHAR(255),
    exchange VARCHAR(50),
    last_trading_price DECIMAL(12, 4),
    market_cap_at_delisting NUMERIC(20, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, delisting_date)
);

-- =====================================================
-- COT (Commitment of Traders) Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS cot_reports (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    report_date DATE NOT NULL,
    commercial_long BIGINT,
    commercial_short BIGINT,
    commercial_net BIGINT,
    non_commercial_long BIGINT,
    non_commercial_short BIGINT,
    non_commercial_net BIGINT,
    non_reportable_long BIGINT,
    non_reportable_short BIGINT,
    open_interest BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, report_date)
);

-- =====================================================
-- DCF and Valuation Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS dcf_models (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    stock_price DECIMAL(12, 4),
    dcf_value DECIMAL(12, 4),
    upside_percentage DECIMAL(8, 4),
    wacc DECIMAL(8, 4),
    terminal_growth_rate DECIMAL(8, 4),
    terminal_value NUMERIC(20, 2),
    enterprise_value NUMERIC(20, 2),
    equity_value NUMERIC(20, 2),
    cash_per_share DECIMAL(12, 4),
    debt_per_share DECIMAL(12, 4),
    sensitivity_analysis JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comparable_valuations (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    peer_group TEXT[],
    median_pe DECIMAL(10, 4),
    median_pb DECIMAL(10, 4),
    median_ps DECIMAL(10, 4),
    median_ev_ebitda DECIMAL(10, 4),
    company_pe DECIMAL(10, 4),
    company_pb DECIMAL(10, 4),
    company_ps DECIMAL(10, 4),
    company_ev_ebitda DECIMAL(10, 4),
    relative_valuation VARCHAR(20), -- UNDERVALUED, FAIR, OVERVALUED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Screener Results Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS screener_results (
    id SERIAL PRIMARY KEY,
    screener_name VARCHAR(100),
    run_date TIMESTAMP NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    match_score DECIMAL(8, 4),
    criteria_met JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE INDEX idx_screener_results_date ON screener_results(run_date DESC);

-- =====================================================
-- Market Breadth Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS market_breadth (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    exchange VARCHAR(50),
    advances INTEGER,
    declines INTEGER,
    unchanged INTEGER,
    advance_decline_ratio DECIMAL(8, 4),
    new_highs_52w INTEGER,
    new_lows_52w INTEGER,
    high_low_ratio DECIMAL(8, 4),
    mcclellan_oscillator DECIMAL(10, 4),
    mcclellan_summation DECIMAL(12, 4),
    arms_index DECIMAL(8, 4),
    put_call_ratio DECIMAL(8, 4),
    vix_value DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, exchange)
);

-- =====================================================
-- Fixed Income Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS bonds (
    id SERIAL PRIMARY KEY,
    cusip VARCHAR(20) UNIQUE,
    isin VARCHAR(20),
    symbol VARCHAR(20),
    issuer_name VARCHAR(255),
    bond_type VARCHAR(50), -- CORPORATE, GOVERNMENT, MUNICIPAL
    maturity_date DATE,
    coupon_rate DECIMAL(8, 4),
    face_value DECIMAL(15, 2),
    currency VARCHAR(10),
    rating_sp VARCHAR(10),
    rating_moodys VARCHAR(10),
    rating_fitch VARCHAR(10),
    callable BOOLEAN,
    convertible BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bond_prices (
    id SERIAL PRIMARY KEY,
    cusip VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    price DECIMAL(12, 4),
    yield DECIMAL(8, 4),
    spread DECIMAL(8, 4),
    duration DECIMAL(8, 4),
    convexity DECIMAL(8, 4),
    volume BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cusip, date),
    FOREIGN KEY (cusip) REFERENCES bonds(cusip) ON DELETE CASCADE
);

-- =====================================================
-- Alternative Data Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS senate_trading (
    id SERIAL PRIMARY KEY,
    senator_name VARCHAR(255),
    state VARCHAR(50),
    party VARCHAR(20),
    symbol VARCHAR(10),
    transaction_date DATE,
    disclosure_date DATE,
    transaction_type VARCHAR(50),
    amount_range VARCHAR(50),
    asset_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS house_trading (
    id SERIAL PRIMARY KEY,
    representative_name VARCHAR(255),
    state VARCHAR(50),
    district VARCHAR(20),
    party VARCHAR(20),
    symbol VARCHAR(10),
    transaction_date DATE,
    disclosure_date DATE,
    transaction_type VARCHAR(50),
    amount_range VARCHAR(50),
    asset_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS government_contracts (
    id SERIAL PRIMARY KEY,
    contractor_name VARCHAR(255),
    symbol VARCHAR(10),
    agency VARCHAR(255),
    contract_date DATE,
    contract_value NUMERIC(20, 2),
    contract_type VARCHAR(100),
    description TEXT,
    completion_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lobbying_data (
    id SERIAL PRIMARY KEY,
    company_name VARCHAR(255),
    symbol VARCHAR(10),
    year INTEGER,
    quarter INTEGER,
    amount_spent NUMERIC(15, 2),
    issues TEXT,
    lobbyists TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- Earnings and Revenue Detail Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS earnings_transcripts (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    quarter INTEGER,
    year INTEGER,
    call_date TIMESTAMP,
    transcript_url VARCHAR(500),
    participants TEXT[],
    word_count INTEGER,
    sentiment_score DECIMAL(5, 2),
    key_topics TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, quarter, year),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS revenue_segments (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    segment_name VARCHAR(255),
    revenue NUMERIC(20, 2),
    operating_income NUMERIC(20, 2),
    assets NUMERIC(20, 2),
    depreciation NUMERIC(15, 2),
    capex NUMERIC(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS geographic_revenue (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    period VARCHAR(10),
    region VARCHAR(255),
    country VARCHAR(100),
    revenue NUMERIC(20, 2),
    percentage_of_total DECIMAL(8, 4),
    growth_yoy DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Enhanced Company Information Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS company_outlook (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    rating DECIMAL(5, 2),
    rating_details JSONB,
    insider_transactions JSONB,
    key_executives JSONB,
    splits_history JSONB,
    stock_dividend JSONB,
    stock_news JSONB,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_count_history (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    employee_count INTEGER,
    change_from_previous INTEGER,
    change_percentage DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_peers (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    peer_symbol VARCHAR(10) NOT NULL,
    correlation_coefficient DECIMAL(5, 4),
    sector_match BOOLEAN,
    industry_match BOOLEAN,
    market_cap_similar BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, peer_symbol),
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

-- =====================================================
-- Enhanced News and Sentiment Tables
-- =====================================================

CREATE TABLE IF NOT EXISTS news_enhanced (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10),
    published_date TIMESTAMP NOT NULL,
    title TEXT,
    text TEXT,
    site VARCHAR(255),
    url VARCHAR(500) UNIQUE,
    image_url VARCHAR(500),
    category VARCHAR(100),
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(5, 2),
    relevance_score DECIMAL(5, 2),
    ticker_sentiment JSONB,
    topics TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES companies(symbol) ON DELETE CASCADE
);

CREATE INDEX idx_news_enhanced_date ON news_enhanced(published_date DESC);
CREATE INDEX idx_news_enhanced_sentiment ON news_enhanced(symbol, sentiment);

-- =====================================================
-- Create Indexes for Performance
-- =====================================================

-- ESG indexes
CREATE INDEX idx_esg_scores_symbol_date ON esg_scores(symbol, date DESC);
CREATE INDEX idx_esg_benchmarks_sector ON esg_benchmarks(sector, year DESC);

-- Options indexes
CREATE INDEX idx_options_chain_symbol ON options_chain(symbol, expiration_date);
CREATE INDEX idx_options_greeks_lookup ON options_greeks(symbol, expiration_date, strike_price);

-- Market performance indexes
CREATE INDEX idx_sector_performance_date ON sector_performance(date DESC);
CREATE INDEX idx_industry_performance_date ON industry_performance(date DESC);

-- Economic indexes
CREATE INDEX idx_gdp_data_country ON gdp_data(country, date DESC);
CREATE INDEX idx_inflation_data_country ON inflation_data(country, date DESC);

-- M&A indexes
CREATE INDEX idx_ma_deals_dates ON ma_deals(announcement_date DESC);
CREATE INDEX idx_bankruptcies_date ON bankruptcies(filing_date DESC);

-- COT indexes
CREATE INDEX idx_cot_reports_symbol ON cot_reports(symbol, report_date DESC);

-- DCF indexes
CREATE INDEX idx_dcf_models_symbol ON dcf_models(symbol, date DESC);

-- Alternative data indexes
CREATE INDEX idx_senate_trading_symbol ON senate_trading(symbol, transaction_date DESC);
CREATE INDEX idx_house_trading_symbol ON house_trading(symbol, transaction_date DESC);

-- Revenue indexes
CREATE INDEX idx_revenue_segments_symbol ON revenue_segments(symbol, date DESC);
CREATE INDEX idx_geographic_revenue_symbol ON geographic_revenue(symbol, date DESC);

-- =====================================================
-- Create Update Triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers to tables with updated_at columns
CREATE TRIGGER update_esg_scores_modtime BEFORE UPDATE ON esg_scores 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_options_chain_modtime BEFORE UPDATE ON options_chain 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_company_outlook_modtime BEFORE UPDATE ON company_outlook 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT USAGE ON SCHEMA fmp TO PUBLIC;
GRANT SELECT ON ALL TABLES IN SCHEMA fmp TO PUBLIC;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA fmp TO PUBLIC;

-- =====================================================
-- Table Statistics
-- =====================================================

COMMENT ON SCHEMA fmp IS 'Financial Modeling Prep complete data schema with all API endpoints coverage';

-- Summary of tables created:
-- ESG: 2 tables
-- Technical Indicators: 1 table
-- Options: 3 tables
-- Market Performance: 4 tables
-- Economic: 3 tables
-- M&A: 3 tables
-- COT: 1 table
-- DCF: 2 tables
-- Screener: 1 table
-- Market Breadth: 1 table
-- Fixed Income: 2 tables
-- Alternative Data: 4 tables
-- Earnings/Revenue: 3 tables
-- Company Info: 3 tables
-- News: 1 table
-- Total New Tables: 34

-- Combined with existing 45 tables = 79 total tables for complete FMP coverage