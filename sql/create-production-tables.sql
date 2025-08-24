-- Production Tables for Complete FMP System
-- Missing tables that need to be created for production readiness

SET search_path TO fmp;

-- Company Ratings Table
CREATE TABLE IF NOT EXISTS company_ratings (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    rating VARCHAR(10),
    rating_score NUMERIC(4, 2),
    rating_recommendation VARCHAR(50),
    rating_details_dcf_score NUMERIC(4, 2),
    rating_details_dcf_recommendation VARCHAR(50),
    rating_details_roe_score NUMERIC(4, 2),
    rating_details_roe_recommendation VARCHAR(50),
    rating_details_pe_score NUMERIC(4, 2),
    rating_details_pe_recommendation VARCHAR(50),
    rating_details_pb_score NUMERIC(4, 2),
    rating_details_pb_recommendation VARCHAR(50),
    rating_details_de_score NUMERIC(4, 2),
    rating_details_de_recommendation VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- IPO Prospectus Documents
CREATE TABLE IF NOT EXISTS ipo_prospectus (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    company_name VARCHAR(255),
    filing_date DATE,
    accepted_date TIMESTAMP,
    sec_filing_url TEXT,
    prospectus_url TEXT,
    form_type VARCHAR(20),
    shares_offered BIGINT,
    price_range_low NUMERIC(10, 2),
    price_range_high NUMERIC(10, 2),
    underwriters TEXT,
    use_of_proceeds TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fail to Deliver Data
CREATE TABLE IF NOT EXISTS fail_to_deliver (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    quantity BIGINT,
    price NUMERIC(12, 4),
    total_value NUMERIC(20, 2),
    cusip VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- Crowdfunding Offerings
CREATE TABLE IF NOT EXISTS crowdfunding_offerings (
    id SERIAL PRIMARY KEY,
    cik VARCHAR(20),
    company_name VARCHAR(255),
    symbol VARCHAR(10),
    offering_date DATE,
    closing_date DATE,
    offering_amount NUMERIC(20, 2),
    amount_raised NUMERIC(20, 2),
    security_type VARCHAR(50),
    minimum_investment NUMERIC(12, 2),
    platform VARCHAR(100),
    status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Form 13F Detailed Holdings
CREATE TABLE IF NOT EXISTS form_13f_detailed (
    id SERIAL PRIMARY KEY,
    cik VARCHAR(20) NOT NULL,
    filing_date DATE NOT NULL,
    report_period DATE NOT NULL,
    cusip VARCHAR(20),
    symbol VARCHAR(10),
    security_name VARCHAR(255),
    shares BIGINT,
    market_value NUMERIC(20, 2),
    investment_discretion VARCHAR(50),
    voting_authority_sole BIGINT,
    voting_authority_shared BIGINT,
    voting_authority_none BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stock Ownership Summary
CREATE TABLE IF NOT EXISTS stock_ownership (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    institutional_ownership_percent NUMERIC(5, 2),
    number_of_institutions INTEGER,
    insider_ownership_percent NUMERIC(5, 2),
    number_of_insiders INTEGER,
    float_percent NUMERIC(5, 2),
    shares_outstanding BIGINT,
    shares_float BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- Mutual Fund Holdings
CREATE TABLE IF NOT EXISTS mutual_fund_holdings (
    id SERIAL PRIMARY KEY,
    fund_symbol VARCHAR(10) NOT NULL,
    fund_name VARCHAR(255),
    holding_symbol VARCHAR(10) NOT NULL,
    holding_name VARCHAR(255),
    shares BIGINT,
    market_value NUMERIC(20, 2),
    weight_percent NUMERIC(6, 3),
    report_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETF Exposure by Stock
CREATE TABLE IF NOT EXISTS etf_exposure (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    etf_symbol VARCHAR(10) NOT NULL,
    etf_name VARCHAR(255),
    shares_held BIGINT,
    weight_percent NUMERIC(6, 3),
    market_value NUMERIC(20, 2),
    report_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upgrades and Downgrades History
CREATE TABLE IF NOT EXISTS analyst_upgrades_downgrades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    analyst_company VARCHAR(100),
    action VARCHAR(20), -- upgrade, downgrade, initiate, reiterate
    from_grade VARCHAR(50),
    to_grade VARCHAR(50),
    price_target_from NUMERIC(10, 2),
    price_target_to NUMERIC(10, 2),
    action_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Share Float History
CREATE TABLE IF NOT EXISTS share_float_history (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    shares_float BIGINT,
    shares_outstanding BIGINT,
    float_percent NUMERIC(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- Stock Screener Criteria
CREATE TABLE IF NOT EXISTS screener_criteria (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    criteria_json JSONB NOT NULL,
    category VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historical Market Cap
CREATE TABLE IF NOT EXISTS historical_market_cap (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    market_cap NUMERIC(20, 2),
    enterprise_value NUMERIC(20, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date)
);

-- System Health Monitoring
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    check_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    check_type VARCHAR(50),
    status VARCHAR(20),
    details JSONB,
    response_time_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Failed Jobs Queue
CREATE TABLE IF NOT EXISTS failed_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(100),
    payload JSONB,
    error_message TEXT,
    error_count INTEGER DEFAULT 1,
    last_error_at TIMESTAMP,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Quality Checks
CREATE TABLE IF NOT EXISTS data_quality_checks (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100),
    check_type VARCHAR(50),
    check_query TEXT,
    expected_result JSONB,
    actual_result JSONB,
    passed BOOLEAN,
    run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Usage Tracking
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255),
    request_count INTEGER,
    success_count INTEGER,
    error_count INTEGER,
    avg_response_time_ms INTEGER,
    date DATE,
    hour INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(endpoint, date, hour)
);

-- Data Update Log
CREATE TABLE IF NOT EXISTS data_update_log (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(100),
    update_type VARCHAR(50),
    records_processed INTEGER,
    records_inserted INTEGER,
    records_updated INTEGER,
    records_failed INTEGER,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    error_details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_ratings_symbol ON company_ratings(symbol);
CREATE INDEX IF NOT EXISTS idx_company_ratings_date ON company_ratings(date);
CREATE INDEX IF NOT EXISTS idx_ipo_prospectus_date ON ipo_prospectus(filing_date);
CREATE INDEX IF NOT EXISTS idx_fail_deliver_symbol ON fail_to_deliver(symbol, date);
CREATE INDEX IF NOT EXISTS idx_crowdfunding_status ON crowdfunding_offerings(status);
CREATE INDEX IF NOT EXISTS idx_ownership_symbol ON stock_ownership(symbol);
CREATE INDEX IF NOT EXISTS idx_hist_mcap_symbol ON historical_market_cap(symbol, date);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ratings_lookup ON company_ratings(symbol, date);
CREATE INDEX IF NOT EXISTS idx_13f_lookup ON form_13f_detailed(symbol, report_period);
CREATE INDEX IF NOT EXISTS idx_mf_holdings_lookup ON mutual_fund_holdings(holding_symbol, report_date);

-- Add triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_ratings_modtime 
    BEFORE UPDATE ON company_ratings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_ownership_modtime 
    BEFORE UPDATE ON stock_ownership 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_screener_criteria_modtime 
    BEFORE UPDATE ON screener_criteria 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fmp TO parthbhatt;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fmp TO parthbhatt;

-- Add table comments for documentation
COMMENT ON TABLE company_ratings IS 'FMP company rating scores and recommendations';
COMMENT ON TABLE ipo_prospectus IS 'IPO filing documents and prospectus information';
COMMENT ON TABLE fail_to_deliver IS 'SEC fail-to-deliver data for short interest analysis';
COMMENT ON TABLE crowdfunding_offerings IS 'Regulation CF and A+ crowdfunding offerings';
COMMENT ON TABLE form_13f_detailed IS 'Detailed institutional holdings from 13F filings';
COMMENT ON TABLE stock_ownership IS 'Aggregate ownership statistics by institution and insider';
COMMENT ON TABLE mutual_fund_holdings IS 'Mutual fund portfolio holdings';
COMMENT ON TABLE etf_exposure IS 'ETF holdings exposure by individual stock';
COMMENT ON TABLE analyst_upgrades_downgrades IS 'Historical analyst rating changes';
COMMENT ON TABLE share_float_history IS 'Historical share float and outstanding shares';
COMMENT ON TABLE historical_market_cap IS 'Historical market capitalization tracking';
COMMENT ON TABLE system_health IS 'System health monitoring and checks';
COMMENT ON TABLE failed_jobs IS 'Failed job queue for retry processing';
COMMENT ON TABLE data_quality_checks IS 'Data quality validation results';
COMMENT ON TABLE api_usage_tracking IS 'FMP API usage statistics';
COMMENT ON TABLE data_update_log IS 'Data update execution history';