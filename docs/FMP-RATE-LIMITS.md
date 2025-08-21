# FMP API Rate Limits & Data Loading Guide

## API Limits
- **Rate Limit**: 3,000 requests per minute
- **Recommended Max**: 2,800 requests/minute (leaves buffer)
- **Per Second**: ~45-50 requests/second max

## Rate-Limited Loading System

### Components

#### 1. Rate Limiter (`src/fmp-rate-limiter.ts`)
- Tracks API calls per minute and per second
- Automatic throttling when approaching limits
- Retry logic with exponential backoff
- Real-time monitoring and statistics
- Batch processing support

#### 2. Batch Loader (`scripts/fmp-batch-loader.ts`)
- Processes multiple symbols efficiently
- Progress tracking with time estimates
- Parallel processing within rate limits
- Error handling and reporting
- Pacific timezone support

#### 3. Economic Calendar Loader (`scripts/load-economic-calendar-tz.ts`)
- Timezone-aware data loading
- Pacific time market session detection
- Bulk insert with conflict resolution

## Usage Examples

### Load Company Data with Rate Limiting
```typescript
import { FMPDataLoader } from './src/fmp-rate-limiter';

const loader = new FMPDataLoader();

// Load S&P 500 companies (will automatically rate limit)
const sp500Symbols = ['AAPL', 'MSFT', 'GOOGL', /* ... more symbols ... */];
await loader.loadCompanyProfiles(sp500Symbols);
```

### Batch Load Multiple Data Types
```typescript
import { FMPBatchLoader } from './scripts/fmp-batch-loader';

const batchLoader = new FMPBatchLoader();

const config = {
  dataTypes: ['profile', 'historical-prices', 'income-statement'],
  period: 'annual',
  historicalDays: 365,  // 1 year of prices
  batchSize: 10  // Process 10 symbols at a time
};

await batchLoader.loadSymbolData(symbols, config);
```

## API Call Calculator

| Data Type | API Calls | Time @ 45/sec | Time @ 2800/min |
|-----------|-----------|---------------|-----------------|
| 1 Symbol - All Data | ~10 calls | 0.2 seconds | 0.2 seconds |
| 100 Symbols - Profile | 100 calls | 2.2 seconds | 2.1 seconds |
| 100 Symbols - 1yr Prices | 100 calls | 2.2 seconds | 2.1 seconds |
| 100 Symbols - All Financials | 400 calls | 8.9 seconds | 8.6 seconds |
| 500 Symbols - Complete | 5,000 calls | 1.9 minutes | 1.8 minutes |
| S&P 500 - Full Load | ~5,000 calls | 1.9 minutes | 1.8 minutes |
| Russell 2000 - Full Load | ~20,000 calls | 7.4 minutes | 7.1 minutes |

## Rate Limit Strategies

### 1. Burst Strategy (Fast)
- Use full 45 requests/second
- Good for small datasets
- Risk of hitting minute limit quickly

### 2. Steady Strategy (Recommended)
- Maintain 40-45 requests/second
- Automatic pauses between batches
- Sustainable for large datasets

### 3. Conservative Strategy (Safe)
- Limit to 30 requests/second
- Longer processing time
- Zero risk of rate limit errors

## Database Optimizations for Bulk Loading

### 1. Batch Inserts
```sql
-- Instead of individual inserts, use bulk insert
INSERT INTO fmp.stock_prices (symbol, date, open, high, low, close, volume)
VALUES 
  ('AAPL', '2025-08-01', 100, 101, 99, 100.5, 1000000),
  ('MSFT', '2025-08-01', 200, 201, 199, 200.5, 2000000),
  -- ... more rows
ON CONFLICT (symbol, date) DO UPDATE SET
  close = EXCLUDED.close,
  volume = EXCLUDED.volume;
```

### 2. Temporary Disable Indexes
```sql
-- Before bulk load
ALTER TABLE fmp.stock_prices DISABLE TRIGGER ALL;
-- Load data
-- After bulk load
ALTER TABLE fmp.stock_prices ENABLE TRIGGER ALL;
REINDEX TABLE fmp.stock_prices;
```

### 3. Use COPY for Maximum Speed
```sql
COPY fmp.stock_prices (symbol, date, open, high, low, close, volume)
FROM '/tmp/stock_prices.csv' 
WITH (FORMAT csv, HEADER true);
```

## Monitoring & Debugging

### Check API Usage
```typescript
const stats = rateLimiter.getStats();
console.log(`Calls in last minute: ${stats.callsInLastMinute}`);
console.log(`Remaining this minute: ${stats.remainingCallsThisMinute}`);
console.log(`Success rate: ${stats.successfulCalls}/${stats.callsInLastMinute}`);
```

### Database Query for Load Status
```sql
-- Check data coverage
SELECT 
  symbol,
  COUNT(DISTINCT DATE(date)) as days_of_data,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(*) as total_records
FROM fmp.stock_prices
GROUP BY symbol
ORDER BY days_of_data DESC;

-- Check missing data
SELECT DISTINCT c.symbol
FROM fmp.companies c
LEFT JOIN fmp.stock_prices sp ON c.symbol = sp.symbol
WHERE sp.symbol IS NULL;
```

## Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| 429 Too Many Requests | Rate limit exceeded | Automatic 60s pause, then retry |
| Connection timeout | Slow API response | Increase timeout to 30s |
| Duplicate key | Data already exists | Use ON CONFLICT DO UPDATE |
| Numeric overflow | Value too large | Check data types, use BIGINT/DECIMAL |

## Best Practices

1. **Always use rate limiter** - Never make direct API calls
2. **Batch similar requests** - Group by data type
3. **Monitor progress** - Use progress tracking for large loads
4. **Handle failures gracefully** - Log errors, retry failed symbols
5. **Respect the API** - Stay under limits, add delays
6. **Cache when possible** - Avoid re-fetching unchanged data
7. **Use database transactions** - Ensure data consistency
8. **Log everything** - Track API usage for billing/debugging

## Scripts Available

| Script | Purpose | Usage |
|--------|---------|-------|
| `load-economic-calendar-tz.ts` | Load economic events | Past/future events with TZ |
| `fmp-batch-loader.ts` | Bulk load symbols | Multiple data types at once |
| `fmp-rate-limiter.ts` | Core rate limiting | Base class for all loaders |

## Pacific Timezone Trading Considerations

- **Market Hours**: 6:30 AM - 1:00 PM PT
- **Pre-Market**: 1:00 AM - 6:30 AM PT  
- **After-Hours**: 1:00 PM - 5:00 PM PT
- **Economic Releases**: Often during market hours
- **Earnings**: Usually before open or after close

All timestamps stored as UTC in database with Pacific time views available.