#!/bin/bash

# PostgreSQL connection details
DB="economic_data"
USER="parthbhatt"
HOST="localhost"

echo "Creating FMP database tables..."
echo "================================"

# Execute each CREATE TABLE statement
psql -h $HOST -U $USER -d $DB << 'EOF'

-- Financial Growth
CREATE TABLE IF NOT EXISTS financial_data.financial_growth (
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
    ten_y_revenue_growth_per_share DECIMAL(12, 4),
    five_y_revenue_growth_per_share DECIMAL(12, 4),
    three_y_revenue_growth_per_share DECIMAL(12, 4),
    ten_y_operating_cf_growth_per_share DECIMAL(12, 4),
    five_y_operating_cf_growth_per_share DECIMAL(12, 4),
    three_y_operating_cf_growth_per_share DECIMAL(12, 4),
    ten_y_net_income_growth_per_share DECIMAL(12, 4),
    five_y_net_income_growth_per_share DECIMAL(12, 4),
    three_y_net_income_growth_per_share DECIMAL(12, 4),
    ten_y_shareholders_equity_growth_per_share DECIMAL(12, 4),
    five_y_shareholders_equity_growth_per_share DECIMAL(12, 4),
    three_y_shareholders_equity_growth_per_share DECIMAL(12, 4),
    ten_y_dividend_per_share_growth_per_share DECIMAL(12, 4),
    five_y_dividend_per_share_growth_per_share DECIMAL(12, 4),
    three_y_dividend_per_share_growth_per_share DECIMAL(12, 4),
    receivables_growth DECIMAL(12, 4),
    inventory_growth DECIMAL(12, 4),
    asset_growth DECIMAL(12, 4),
    book_value_per_share_growth DECIMAL(12, 4),
    debt_growth DECIMAL(12, 4),
    rd_expense_growth DECIMAL(12, 4),
    sga_expenses_growth DECIMAL(12, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date, period),
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Enterprise Values
CREATE TABLE IF NOT EXISTS financial_data.enterprise_values (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Real-time Quotes
CREATE TABLE IF NOT EXISTS financial_data.real_time_quotes (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Intraday Prices
CREATE TABLE IF NOT EXISTS financial_data.intraday_prices (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Dividends
CREATE TABLE IF NOT EXISTS financial_data.dividends (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Stock Splits
CREATE TABLE IF NOT EXISTS financial_data.stock_splits (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    label VARCHAR(100),
    numerator INTEGER,
    denominator INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Analyst Estimates
CREATE TABLE IF NOT EXISTS financial_data.analyst_estimates (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Price Targets
CREATE TABLE IF NOT EXISTS financial_data.price_targets (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Stock Grades
CREATE TABLE IF NOT EXISTS financial_data.stock_grades (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    grading_company VARCHAR(255),
    previous_grade VARCHAR(50),
    new_grade VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Earnings Surprises
CREATE TABLE IF NOT EXISTS financial_data.earnings_surprises (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    actual_earnings_per_share DECIMAL(10, 4),
    estimated_earnings DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(symbol, date),
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Institutional Holders
CREATE TABLE IF NOT EXISTS financial_data.institutional_holders (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    holder VARCHAR(255),
    shares BIGINT,
    date_reported DATE,
    change BIGINT,
    change_percentage DECIMAL(8, 4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Insider Trading
CREATE TABLE IF NOT EXISTS financial_data.insider_trading (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- SEC Filings
CREATE TABLE IF NOT EXISTS financial_data.sec_filings (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    filing_date DATE,
    accepted_date TIMESTAMP,
    cik VARCHAR(20),
    type VARCHAR(20),
    link VARCHAR(500),
    final_link VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Additional tables without foreign key constraints

-- ETF Holdings
CREATE TABLE IF NOT EXISTS financial_data.etf_holdings (
    id SERIAL PRIMARY KEY,
    etf_symbol VARCHAR(10) NOT NULL,
    asset VARCHAR(255),
    shares_number BIGINT,
    weight_percentage DECIMAL(8, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETF Sector Weights
CREATE TABLE IF NOT EXISTS financial_data.etf_sector_weights (
    id SERIAL PRIMARY KEY,
    etf_symbol VARCHAR(10) NOT NULL,
    sector VARCHAR(100),
    weight_percentage DECIMAL(8, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ETF Country Weights
CREATE TABLE IF NOT EXISTS financial_data.etf_country_weights (
    id SERIAL PRIMARY KEY,
    etf_symbol VARCHAR(10) NOT NULL,
    country VARCHAR(100),
    weight_percentage DECIMAL(8, 4),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Market Indexes
CREATE TABLE IF NOT EXISTS financial_data.market_indexes (
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
CREATE TABLE IF NOT EXISTS financial_data.index_prices (
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

-- Economic Calendar
CREATE TABLE IF NOT EXISTS financial_data.economic_calendar (
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

-- Treasury Rates
CREATE TABLE IF NOT EXISTS financial_data.treasury_rates (
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

-- Cryptocurrency Quotes
CREATE TABLE IF NOT EXISTS financial_data.crypto_quotes (
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
CREATE TABLE IF NOT EXISTS financial_data.crypto_prices (
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
CREATE TABLE IF NOT EXISTS financial_data.forex_quotes (
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
CREATE TABLE IF NOT EXISTS financial_data.forex_prices (
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
CREATE TABLE IF NOT EXISTS financial_data.commodity_quotes (
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
CREATE TABLE IF NOT EXISTS financial_data.commodity_prices (
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

-- Press Releases
CREATE TABLE IF NOT EXISTS financial_data.press_releases (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    date TIMESTAMP,
    title TEXT,
    text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Social Sentiment
CREATE TABLE IF NOT EXISTS financial_data.social_sentiment (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Symbols List
CREATE TABLE IF NOT EXISTS financial_data.symbols_list (
    symbol VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255),
    price DECIMAL(12, 4),
    exchange VARCHAR(50),
    exchange_short_name VARCHAR(20),
    type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IPO Calendar
CREATE TABLE IF NOT EXISTS financial_data.ipo_calendar (
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
CREATE TABLE IF NOT EXISTS financial_data.split_calendar (
    id SERIAL PRIMARY KEY,
    date DATE,
    label VARCHAR(100),
    symbol VARCHAR(10),
    numerator INTEGER,
    denominator INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Dividend Calendar
CREATE TABLE IF NOT EXISTS financial_data.dividend_calendar (
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
    FOREIGN KEY (symbol) REFERENCES financial_data.companies(symbol) ON DELETE CASCADE
);

-- Show summary
SELECT 'Tables created successfully!' as status;
SELECT COUNT(*) as table_count FROM information_schema.tables 
WHERE table_schema = 'financial_data';

EOF

echo "================================"
echo "FMP database tables creation completed!"
echo ""
echo "Verifying tables..."
psql -h $HOST -U $USER -d $DB -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'financial_data' ORDER BY table_name;" | sed 's/^/  - /'