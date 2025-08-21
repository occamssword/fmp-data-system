# FMP Data System - Automated Updates Setup

## Overview
The FMP Data System includes automated update capabilities through cron jobs. Two types of updates are available:

1. **Incremental Updates** - Quick updates for real-time quotes and recent data (runs in 2-3 minutes)
2. **Comprehensive Updates** - Full historical data updates (runs in 10-15 minutes)

## Scripts

### 1. Incremental Update (`incremental-update.ts`)
Updates only the most recent data:
- Real-time stock quotes
- Recent price history (last 7 days)
- Today's earnings calendar
- Economic events (past day to next week)
- Market indexes
- Latest treasury rates
- Commodity and forex quotes
- New financial reports

**Usage:**
```bash
node dist/scripts/incremental-update.js [days_lookback]
# Example: node dist/scripts/incremental-update.js 7
```

### 2. Comprehensive Update (`update-all-timeseries-data.ts`)
Updates all historical timeseries data:
- All 27 data tables
- Historical prices for specified years
- All financial statements
- All metrics and ratios
- Market data (indexes, commodities, forex, crypto)

**Usage:**
```bash
node dist/scripts/update-all-timeseries-data.js [years_back]
# Example: node dist/scripts/update-all-timeseries-data.js 5
```

## Setting Up Cron Jobs

### Quick Setup
Run the interactive setup script:
```bash
./scripts/setup-cron.sh
```

This will present options for common update schedules:
1. Every 15 minutes (during market hours)
2. Every hour (24/7)
3. Every 4 hours
4. Daily at 6 AM
5. Daily at 6 PM
6. Weekdays at 9:30 AM (market open)
7. Weekdays at 4:30 PM (after market close)
8. Custom schedule

### Manual Cron Setup

#### For Incremental Updates (Recommended)
```bash
# Every hour
0 * * * * /path/to/fmp-data-system/scripts/fmp-cron-update.sh

# Every 15 minutes during market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
*/15 9-16 * * 1-5 /path/to/fmp-data-system/scripts/fmp-cron-update.sh

# Twice daily - morning and evening
0 6,18 * * * /path/to/fmp-data-system/scripts/fmp-cron-update.sh
```

#### For Comprehensive Updates
```bash
# Weekly on Sunday at 2 AM
0 2 * * 0 cd /path/to/fmp-data-system && npm run build && node dist/scripts/update-all-timeseries-data.js 2

# Monthly on the 1st at 3 AM
0 3 1 * * cd /path/to/fmp-data-system && npm run build && node dist/scripts/update-all-timeseries-data.js 2
```

### View Current Cron Jobs
```bash
crontab -l | grep fmp
```

### Remove Cron Jobs
```bash
# Remove all FMP cron jobs
./scripts/setup-cron.sh
# Select option 9
```

## Logs and Monitoring

### Log Location
Logs are saved to: `./logs/fmp_update_*.log`

### View Recent Logs
```bash
# Latest log
tail -f logs/fmp_update_*.log

# All logs from today
ls -la logs/fmp_update_$(date +%Y%m%d)*.log
```

### Monitor Update Status
A JSON log is maintained at `/tmp/fmp_update_log.json` with summary statistics for each run:
```bash
cat /tmp/fmp_update_log.json | jq '.'
```

### Clean Up Old Logs
The cron script automatically:
- Deletes logs older than 30 days
- Compresses logs larger than 100MB

## Recommended Update Schedules

### For Live Trading Systems
- **Real-time quotes**: Every 5-15 minutes during market hours
- **Price history**: Every hour
- **Financial statements**: Daily after market close
- **Economic data**: Daily at 6 AM

### For Analysis/Research
- **Incremental updates**: Daily at 6 PM
- **Comprehensive updates**: Weekly on weekends

### For Long-term Data Collection
- **Incremental updates**: Daily
- **Comprehensive updates**: Monthly

## Troubleshooting

### Check if cron is running
```bash
ps aux | grep cron
```

### Check cron logs
```bash
# On macOS
log show --predicate 'process == "cron"' --last 1h

# On Linux
grep CRON /var/log/syslog
```

### Test the update script manually
```bash
./scripts/fmp-cron-update.sh
```

### Common Issues

1. **Permission denied**
   ```bash
   chmod +x scripts/*.sh
   ```

2. **Node/npm not found**
   - Add full paths in cron script
   - Or source your shell profile in the cron script

3. **Database connection issues**
   - Ensure .env file is in project root
   - Check PostgreSQL is running
   - Verify database credentials

4. **API rate limits**
   - Reduce update frequency
   - Use incremental updates instead of comprehensive
   - Check API usage in logs

## API Rate Limits
- FMP API allows 3000 requests per minute
- Scripts use maximum 2800 requests/minute (safety buffer)
- Incremental updates use ~100-200 requests
- Comprehensive updates use ~800-1500 requests

## Database Maintenance

### Regular cleanup (add to cron)
```bash
# Weekly cleanup of old intraday data
0 3 * * 0 psql -U parthbhatt -d fmpdata -c "DELETE FROM fmp.intraday_prices WHERE date < CURRENT_DATE - INTERVAL '30 days';"

# Monthly VACUUM
0 4 1 * * psql -U parthbhatt -d fmpdata -c "VACUUM ANALYZE fmp.stock_prices, fmp.real_time_quotes;"
```

## Support

For issues or questions:
1. Check logs in `./logs/`
2. Review `/tmp/fmp_update_log.json`
3. Test manual execution
4. Verify API key and database connectivity