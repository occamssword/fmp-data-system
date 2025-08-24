#!/bin/bash

# FMP System Status Report
# Provides a comprehensive overview of the system status

echo "╔══════════════════════════════════════════════════════════╗"
echo "║            FMP DATA SYSTEM STATUS REPORT                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Generated: $(date)"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Function to check service
check_service() {
    local service=$1
    local process=$2
    
    if pgrep -f "$process" > /dev/null; then
        echo -e "${GREEN}✓${NC} $service: Running"
        return 0
    else
        echo -e "${RED}✗${NC} $service: Not running"
        return 1
    fi
}

# 1. Service Status
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ SERVICE STATUS                                          │"
echo "└─────────────────────────────────────────────────────────┘"
check_service "PostgreSQL" "postgres"
check_service "Monitoring Dashboard" "monitoring-server.js"
check_service "Node.js Workers" "node.*fmp"
echo ""

# 2. Database Statistics
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ DATABASE STATISTICS                                     │"
echo "└─────────────────────────────────────────────────────────┘"

psql -U parthbhatt -d fmpdata -t -c "
SELECT 
    'Total Tables: ' || COUNT(*) || ' tables' as metric
FROM information_schema.tables 
WHERE table_schema = 'fmp'
UNION ALL
SELECT 
    'Database Size: ' || pg_size_pretty(pg_database_size('fmpdata'))
UNION ALL
SELECT 
    'Total Records: ' || TO_CHAR(
        (SELECT SUM(n.n_live_tup) 
         FROM pg_stat_user_tables n 
         WHERE n.schemaname = 'fmp'), 
        'FM999,999,999'
    ) || ' rows'
UNION ALL
SELECT 
    'Active Connections: ' || COUNT(*) || ' connections'
FROM pg_stat_activity 
WHERE datname = 'fmpdata';" 2>/dev/null || echo "Database unavailable"

echo ""

# 3. Top Tables by Size
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ TOP 10 TABLES BY ROW COUNT                             │"
echo "└─────────────────────────────────────────────────────────┘"

psql -U parthbhatt -d fmpdata -c "
SELECT 
    table_name as \"Table\",
    TO_CHAR((xpath('/row/count/text()', 
     query_to_xml(format('SELECT COUNT(*) FROM fmp.%I', table_name), 
     true, true, '')))[1]::text::int, 'FM999,999,999') as \"Rows\",
    pg_size_pretty(pg_total_relation_size('fmp.' || table_name)) as \"Size\"
FROM information_schema.tables 
WHERE table_schema = 'fmp' 
AND table_type = 'BASE TABLE'
ORDER BY (xpath('/row/count/text()', 
 query_to_xml(format('SELECT COUNT(*) FROM fmp.%I', table_name), 
 true, true, '')))[1]::text::int DESC NULLS LAST
LIMIT 10;" 2>/dev/null || echo "Unable to query tables"

echo ""

# 4. Data Freshness
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ DATA FRESHNESS                                         │"
echo "└─────────────────────────────────────────────────────────┘"

psql -U parthbhatt -d fmpdata -t -c "
SELECT 
    'Stock Prices: ' || 
    COALESCE(
        'Last updated ' || 
        EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/3600 || ' hours ago',
        'No data'
    )
FROM fmp.stock_prices
UNION ALL
SELECT 
    'Companies: ' || 
    COALESCE(
        'Last updated ' || 
        EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))/3600 || ' hours ago',
        'No data'
    )
FROM fmp.companies
UNION ALL
SELECT 
    'Economic Calendar: ' || 
    COALESCE(
        COUNT(*) || ' events loaded',
        'No data'
    )
FROM fmp.economic_calendar;" 2>/dev/null || echo "Unable to check data freshness"

echo ""

# 5. Recent Activity
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ RECENT ACTIVITY (Last 24 Hours)                        │"
echo "└─────────────────────────────────────────────────────────┘"

# Check for recent log entries
if [ -f logs/incremental.log ]; then
    RECENT_LOGS=$(tail -5 logs/incremental.log 2>/dev/null | wc -l)
    echo "Recent log entries: $RECENT_LOGS"
else
    echo "No log files found"
fi

# Check cron jobs
echo ""
echo "Scheduled Jobs:"
crontab -l 2>/dev/null | grep -i fmp | head -3 || echo "No cron jobs configured"

echo ""

# 6. System Resources
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ SYSTEM RESOURCES                                       │"
echo "└─────────────────────────────────────────────────────────┘"

# Memory usage
MEM_TOTAL=$(sysctl -n hw.memsize 2>/dev/null | awk '{printf "%.1f", $1/1024/1024/1024}')
MEM_PRESSURE=$(memory_pressure 2>/dev/null | grep "System-wide memory free percentage" | awk '{print $5}')

echo "Memory: ${MEM_TOTAL}GB total, ${MEM_PRESSURE:-N/A} free"

# Disk usage
DISK_USAGE=$(df -h . | tail -1 | awk '{print $4 " free of " $2}')
echo "Disk: $DISK_USAGE"

# CPU load
LOAD=$(uptime | awk -F'load averages:' '{print $2}')
echo "Load Average:$LOAD"

echo ""

# 7. Quick Actions
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ QUICK ACTIONS                                          │"
echo "└─────────────────────────────────────────────────────────┘"
echo "• View Dashboard:     http://localhost:3001"
echo "• Start Monitoring:   ./scripts/start-monitoring.sh"
echo "• Run Full Update:    node dist/scripts/update-complete-fmp-data.js"
echo "• Check Logs:         tail -f logs/incremental.log"
echo "• Database Console:   psql -U parthbhatt -d fmpdata"
echo ""

# 8. Health Summary
echo "┌─────────────────────────────────────────────────────────┐"
echo "│ OVERALL HEALTH                                         │"
echo "└─────────────────────────────────────────────────────────┘"

# Calculate health score
HEALTH_SCORE=100
ISSUES=""

# Check if database is accessible
if ! psql -U parthbhatt -d fmpdata -c "SELECT 1" &>/dev/null; then
    HEALTH_SCORE=$((HEALTH_SCORE - 50))
    ISSUES="${ISSUES}• Database connection failed\n"
fi

# Check if monitoring is running
if ! pgrep -f "monitoring-server.js" > /dev/null; then
    HEALTH_SCORE=$((HEALTH_SCORE - 10))
    ISSUES="${ISSUES}• Monitoring dashboard not running\n"
fi

# Check if logs directory exists
if [ ! -d "logs" ]; then
    HEALTH_SCORE=$((HEALTH_SCORE - 5))
    ISSUES="${ISSUES}• Logs directory missing\n"
fi

# Display health status
if [ $HEALTH_SCORE -ge 90 ]; then
    echo -e "${GREEN}★★★★★ EXCELLENT${NC} - System is fully operational ($HEALTH_SCORE%)"
elif [ $HEALTH_SCORE -ge 70 ]; then
    echo -e "${GREEN}★★★★☆ GOOD${NC} - System is operational with minor issues ($HEALTH_SCORE%)"
elif [ $HEALTH_SCORE -ge 50 ]; then
    echo -e "${YELLOW}★★★☆☆ WARNING${NC} - System has some issues ($HEALTH_SCORE%)"
else
    echo -e "${RED}★★☆☆☆ CRITICAL${NC} - System needs attention ($HEALTH_SCORE%)"
fi

if [ -n "$ISSUES" ]; then
    echo ""
    echo "Issues detected:"
    echo -e "$ISSUES"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                    END OF REPORT                         ║"
echo "╚══════════════════════════════════════════════════════════╝"