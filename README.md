# FMP Data System

A production-ready financial data platform with real-time monitoring that collects, stores, and manages data from the Financial Modeling Prep (FMP) API.

## 🚀 System Highlights

- **94 Database Tables** with 100% FMP API coverage
- **Real-time Monitoring Dashboard** at http://localhost:3001
- **103,000+ Records** loaded and growing
- **Automated Updates** via cron scheduling
- **Production Ready** with Docker support

## Features

### Complete Data Coverage (94 Tables)
- **Stock Market Data**: Prices, quotes, intraday, technical indicators
- **Financial Statements**: Income, balance sheet, cash flow (quarterly/annual)
- **Company Information**: Profiles, executives, ratings, peers
- **Market Analytics**: Sector performance, market breadth, indexes
- **Options Data**: Options chain, Greeks, flow analysis
- **Alternative Data**: ESG scores, senate/house trading, M&A deals
- **Economic Data**: GDP, inflation, treasury rates, economic calendar
- **Commodities & Forex**: Real-time and historical prices
- **Cryptocurrency**: Major crypto pairs tracking

### Real-time Monitoring Dashboard
- **Web Interface**: Beautiful dashboard at http://localhost:3001
- **Live Metrics**: Real-time API usage and system health
- **Log Streaming**: Live log viewer with WebSocket support
- **System Status**: Comprehensive health checks and alerts
- **API Endpoints**: RESTful API for programmatic access

### Automated Updates
- **Incremental Updates**: Hourly real-time data refresh
- **Extended Updates**: Twice daily comprehensive updates
- **Full Updates**: Weekly complete data synchronization
- **Smart Scheduling**: Automatic update type selection based on time

### Production Features
- **Rate Limiting**: Intelligent API usage with 2800 req/min safety buffer
- **Error Recovery**: Automatic retry with exponential backoff
- **Circuit Breakers**: Prevent cascading failures
- **Health Monitoring**: Continuous system health checks
- **Docker Support**: Full containerization with docker-compose

## Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- FMP API key (get from https://financialmodelingprep.com/)

## Quick Start

### Installation

1. Clone the repository:
```bash
git clone https://github.com/occamssword/fmp-data-system.git
cd fmp-data-system
```

2. Install dependencies:
```bash
npm install
```

3. Deploy the system:
```bash
# Quick deployment
./scripts/deploy-system.sh
```

### Start Monitoring Dashboard

```bash
# Start monitoring server
./scripts/start-monitoring.sh

# View dashboard in browser
open http://localhost:3001

# Check system status
./scripts/system-status.sh
```

### Manual Setup

1. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your FMP API key and database credentials
```

4. Create the database:
```bash
createdb fmpdata
```

5. Set up database schema:
```bash
npm run setup-db
```

## Configuration

Edit `.env` file with your configuration:

```env
# FMP API Configuration
FMP_API_KEY=your_fmp_api_key_here

# PostgreSQL Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fmpdata
DB_USER=your_username
DB_PASSWORD=your_password

# Rate Limiting Configuration
FMP_RATE_LIMIT_PER_MINUTE=300
FMP_RATE_LIMIT_PER_DAY=25000
```

## Usage

### Build the project
```bash
npm run build
```

### Load all FMP data
```bash
npm run load-data
```

### Load specific data types
```bash
# Load batch data
npm run load-batch

# Load premium data
npm run load-premium

# Load economic calendar
npm run load-calendar
```

### Test database connection
```bash
npm test
```

## Project Structure

```
fmp-data-system/
├── src/                    # Source code
│   ├── fmp-loader.ts      # Main FMP data loader
│   ├── fmp-rate-limiter.ts # Rate limiting implementation
│   └── database.ts        # Database connection and utilities
├── scripts/               # Data loading scripts
│   ├── fmp-batch-loader.ts
│   ├── load-all-fmp-data.ts
│   ├── load-economic-calendar.ts
│   └── load-fmp-premium-data.ts
├── sql/                   # SQL schema files
│   ├── create-fmpdata-schema.sql
│   └── create-fmp-additional-tables.sql
├── docs/                  # Documentation
│   ├── FMP-API-DOCUMENTATION.md
│   └── FMP-RATE-LIMITS.md
└── test/                  # Test files
```

## Database Schema

The system creates comprehensive tables for:
- Company profiles and financials
- Stock prices and historical data
- Economic indicators
- Forex rates
- Commodities data
- ETF information
- Economic calendar events
- Market indices
- And much more...

## API Rate Limits

The system respects FMP API rate limits:
- 300 requests per minute
- 25,000 requests per day

Rate limiting is automatically handled by the `fmp-rate-limiter` module.

## Available Data Endpoints

- Company financial statements
- Stock prices (real-time and historical)
- Economic calendar
- Forex rates
- Commodities prices
- Crypto prices
- Market indices
- ETF data
- Earnings calendars
- IPO calendars
- Stock screeners
- Technical indicators

## Error Handling

The system includes comprehensive error handling:
- Automatic retry with exponential backoff
- Rate limit compliance
- Database transaction management
- Detailed error logging

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

## Acknowledgments

- Financial Modeling Prep for providing the comprehensive financial data API
- PostgreSQL for reliable data storage
- Node.js community for excellent packages and tools