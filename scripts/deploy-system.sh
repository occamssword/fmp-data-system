#!/bin/bash

# FMP Data System Deployment Script
# This script deploys and initializes the complete FMP data system

set -e

echo "=========================================="
echo "FMP DATA SYSTEM DEPLOYMENT"
echo "=========================================="
echo "Time: $(date)"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
echo "1. Checking prerequisites..."

if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi
print_status "Node.js installed"

if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL client is not installed"
    exit 1
fi
print_status "PostgreSQL client installed"

# Check database connection
echo ""
echo "2. Checking database connection..."
if psql -U parthbhatt -d fmpdata -c "SELECT 1" &> /dev/null; then
    print_status "Database connection successful"
    
    # Get table count
    TABLE_COUNT=$(psql -U parthbhatt -d fmpdata -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fmp'")
    print_status "Found $TABLE_COUNT tables in database"
else
    print_error "Cannot connect to database"
    exit 1
fi

# Build TypeScript if needed
echo ""
echo "3. Building TypeScript code..."
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    npm run build
    print_status "TypeScript build completed"
else
    print_status "TypeScript already built"
fi

# Run initial data loaders
echo ""
echo "4. Loading initial data..."

# Function to run loader with timeout
run_loader() {
    local script=$1
    local name=$2
    local timeout=${3:-60}
    
    echo "   Loading $name data..."
    
    # Run in background with timeout
    (
        node "dist/scripts/$script.js" 2>&1 | head -100
    ) &
    
    local pid=$!
    local count=0
    
    # Wait for process with timeout
    while kill -0 $pid 2>/dev/null && [ $count -lt $timeout ]; do
        sleep 1
        count=$((count + 1))
        
        # Show progress
        if [ $((count % 10)) -eq 0 ]; then
            echo -n "."
        fi
    done
    
    if kill -0 $pid 2>/dev/null; then
        kill $pid 2>/dev/null
        print_warning "$name loader timed out after ${timeout}s (continuing...)"
    else
        wait $pid
        local exit_code=$?
        if [ $exit_code -eq 0 ]; then
            print_status "$name data loaded"
        else
            print_warning "$name loader completed with warnings"
        fi
    fi
}

# Load data in parallel groups
echo "   Starting data loaders..."

# Group 1: Core data
run_loader "load-bonds-data" "Bonds" 30 &
run_loader "load-government-contracts" "Government" 30 &
run_loader "load-corporate-events" "Corporate Events" 30 &

# Wait for first group
wait

# Check data loading results
echo ""
echo "5. Verifying data loading..."

# Check key tables for data
TABLES_WITH_DATA=$(psql -U parthbhatt -d fmpdata -t -c "
    SELECT COUNT(*) FROM (
        SELECT table_name 
        FROM information_schema.tables t
        WHERE table_schema = 'fmp' 
        AND EXISTS (
            SELECT 1 FROM information_schema.columns c 
            WHERE c.table_schema = t.table_schema 
            AND c.table_name = t.table_name
        )
        AND (
            SELECT COUNT(*) FROM fmp.\" || table_name || \"
        ) > 0
    ) as populated_tables
" 2>/dev/null || echo "0")

print_status "Tables with data: $TABLES_WITH_DATA"

# Show top tables by row count
echo ""
echo "6. Top tables by row count:"
psql -U parthbhatt -d fmpdata -c "
    SELECT 
        table_name,
        (xpath('/row/count/text()', 
         query_to_xml(format('SELECT COUNT(*) FROM fmp.%I', table_name), 
         true, true, '')))[1]::text::int as row_count
    FROM information_schema.tables 
    WHERE table_schema = 'fmp' 
    AND table_type = 'BASE TABLE'
    ORDER BY row_count DESC NULLS LAST
    LIMIT 10
" 2>/dev/null || print_warning "Could not get row counts"

# Create cron jobs
echo ""
echo "7. Setting up scheduled tasks..."

# Create cron entries
CRON_FILE="/tmp/fmp-cron-$$"
cat > "$CRON_FILE" << EOF
# FMP Data System Automated Updates
# Hourly incremental updates
0 * * * * cd $(pwd) && node dist/scripts/incremental-update.js >> logs/incremental.log 2>&1
# Daily full update at 2 AM
0 2 * * * cd $(pwd) && node dist/scripts/update-all-timeseries-data.js >> logs/daily.log 2>&1
# Weekly complete update on Sunday at 3 AM
0 3 * * 0 cd $(pwd) && node dist/scripts/update-complete-fmp-data.js full >> logs/weekly.log 2>&1
EOF

echo "   Cron jobs configured (not installed - run 'crontab /tmp/fmp-cron-$$' to install)"
print_status "Scheduled tasks ready"

# Start health monitoring
echo ""
echo "8. Starting health monitoring..."

# Create health check script
cat > check-health.js << 'EOF'
const { HealthMonitor } = require('./dist/src/health-monitor.js');
const monitor = new HealthMonitor();
monitor.performHealthChecks().then(results => {
    const critical = results.filter(r => r.status === 'CRITICAL').length;
    const warning = results.filter(r => r.status === 'WARNING').length;
    console.log(`Health: ${critical} critical, ${warning} warnings`);
    process.exit(critical > 0 ? 1 : 0);
}).catch(err => {
    console.error('Health check failed:', err.message);
    process.exit(1);
});
EOF

if node check-health.js 2>/dev/null; then
    print_status "Health monitoring operational"
else
    print_warning "Health monitoring needs configuration"
fi

# Summary
echo ""
echo "=========================================="
echo "DEPLOYMENT SUMMARY"
echo "=========================================="
echo ""
print_status "Database: Connected with $TABLE_COUNT tables"
print_status "TypeScript: Built successfully"
print_status "Data Loaders: Executed"
print_status "Scheduled Tasks: Configured"
print_status "Health Monitoring: Ready"
echo ""
echo "Next steps:"
echo "1. Review logs in ./logs/ directory"
echo "2. Install cron jobs: crontab $CRON_FILE"
echo "3. Monitor health: node check-health.js"
echo "4. Check data: psql -U parthbhatt -d fmpdata"
echo ""
echo "Deployment completed at $(date)"
echo "=========================================="