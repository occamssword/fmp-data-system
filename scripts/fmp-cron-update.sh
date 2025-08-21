#!/bin/bash

# FMP Data System - Cron Update Script
# This script is designed to be run by cron for automatic updates

# Set the working directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Set up environment
export NODE_ENV=production
export PATH=/usr/local/bin:/usr/bin:/bin:$PATH

# Log file with timestamp
LOG_FILE="$LOG_DIR/fmp_update_$(date +%Y%m%d_%H%M%S).log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Change to project directory
cd "$PROJECT_DIR"

log_message "Starting FMP incremental update"
log_message "Project directory: $PROJECT_DIR"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_message "Installing dependencies..."
    npm install >> "$LOG_FILE" 2>&1
fi

# Build TypeScript if needed
if [ ! -d "dist" ] || [ "$(find src scripts -name '*.ts' -newer dist -print -quit 2>/dev/null)" ]; then
    log_message "Building TypeScript..."
    npm run build >> "$LOG_FILE" 2>&1
    
    if [ $? -ne 0 ]; then
        log_message "ERROR: Build failed"
        exit 1
    fi
fi

# Determine which update to run based on time
HOUR=$(date +%H)
DAY=$(date +%w)

# Run different updates based on schedule
if [ "$1" == "full" ]; then
    # Force full update if specified
    log_message "Running FULL data update (forced)..."
    node dist/scripts/update-complete-fmp-data.js full 30 >> "$LOG_FILE" 2>&1
elif [ "$DAY" -eq 0 ] && [ "$HOUR" -eq 2 ]; then
    # Weekly comprehensive update on Sunday at 2 AM
    log_message "Running weekly FULL data update..."
    node dist/scripts/update-complete-fmp-data.js full 30 >> "$LOG_FILE" 2>&1
elif [ "$HOUR" -eq 6 ] || [ "$HOUR" -eq 18 ]; then
    # Twice daily extended update at 6 AM and 6 PM
    log_message "Running extended incremental update..."
    node dist/scripts/update-complete-fmp-data.js incremental 7 >> "$LOG_FILE" 2>&1
else
    # Regular incremental update
    log_message "Running regular incremental update..."
    node dist/scripts/incremental-update.js 7 >> "$LOG_FILE" 2>&1
fi

UPDATE_EXIT_CODE=$?

if [ $UPDATE_EXIT_CODE -eq 0 ]; then
    log_message "Update completed successfully"
else
    log_message "ERROR: Update failed with exit code $UPDATE_EXIT_CODE"
fi

# Clean up old logs (keep last 30 days)
find "$LOG_DIR" -name "fmp_update_*.log" -mtime +30 -delete 2>/dev/null

# Rotate logs if they get too large (>100MB)
for log in "$LOG_DIR"/fmp_update_*.log; do
    if [ -f "$log" ] && [ $(stat -f%z "$log" 2>/dev/null || stat -c%s "$log" 2>/dev/null) -gt 104857600 ]; then
        gzip "$log"
    fi
done

log_message "Cron job completed"

exit $UPDATE_EXIT_CODE