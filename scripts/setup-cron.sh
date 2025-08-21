#!/bin/bash

# FMP Data System - Cron Setup Script
# Sets up automated data updates using cron

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CRON_SCRIPT="$SCRIPT_DIR/fmp-cron-update.sh"

echo "======================================"
echo "FMP Data System - Cron Job Setup"
echo "======================================"
echo ""

# Function to add cron job
add_cron_job() {
    local schedule="$1"
    local description="$2"
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$CRON_SCRIPT"; then
        echo "⚠️  Cron job already exists. Removing old entry..."
        # Remove existing entry
        crontab -l 2>/dev/null | grep -v "$CRON_SCRIPT" | crontab -
    fi
    
    # Add new cron job
    (crontab -l 2>/dev/null; echo "# FMP Data System - $description"; echo "$schedule $CRON_SCRIPT") | crontab -
    
    if [ $? -eq 0 ]; then
        echo "✅ Cron job added successfully!"
        echo "   Schedule: $schedule"
        echo "   Description: $description"
    else
        echo "❌ Failed to add cron job"
        return 1
    fi
}

# Display menu
echo "Select update frequency:"
echo "1) Every 15 minutes (real-time quotes during market hours)"
echo "2) Every hour (24/7)"
echo "3) Every 4 hours"
echo "4) Daily at 6 AM"
echo "5) Daily at 6 PM"
echo "6) Weekdays at 9:30 AM (market open)"
echo "7) Weekdays at 4:30 PM (after market close)"
echo "8) Custom schedule"
echo "9) Remove all FMP cron jobs"
echo "0) Exit"
echo ""

read -p "Enter your choice (0-9): " choice

case $choice in
    1)
        # Every 15 minutes during market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
        add_cron_job "*/15 9-16 * * 1-5" "Every 15 minutes during market hours"
        ;;
    2)
        # Every hour
        add_cron_job "0 * * * *" "Every hour"
        ;;
    3)
        # Every 4 hours
        add_cron_job "0 */4 * * *" "Every 4 hours"
        ;;
    4)
        # Daily at 6 AM
        add_cron_job "0 6 * * *" "Daily at 6 AM"
        ;;
    5)
        # Daily at 6 PM
        add_cron_job "0 18 * * *" "Daily at 6 PM"
        ;;
    6)
        # Weekdays at 9:30 AM (market open)
        add_cron_job "30 9 * * 1-5" "Weekdays at 9:30 AM (market open)"
        ;;
    7)
        # Weekdays at 4:30 PM (after market close)
        add_cron_job "30 16 * * 1-5" "Weekdays at 4:30 PM (after market close)"
        ;;
    8)
        # Custom schedule
        echo ""
        echo "Enter custom cron schedule"
        echo "Format: minute hour day month weekday"
        echo "Example: */30 * * * * (every 30 minutes)"
        echo "Example: 0 9,12,15 * * 1-5 (9AM, 12PM, 3PM on weekdays)"
        read -p "Schedule: " custom_schedule
        read -p "Description: " custom_description
        add_cron_job "$custom_schedule" "$custom_description"
        ;;
    9)
        # Remove all FMP cron jobs
        echo "Removing all FMP cron jobs..."
        crontab -l 2>/dev/null | grep -v "$CRON_SCRIPT" | crontab -
        echo "✅ All FMP cron jobs removed"
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "Current cron jobs:"
echo "=================="
crontab -l 2>/dev/null | grep -A1 "FMP Data System" || echo "No FMP cron jobs found"

echo ""
echo "Logs will be saved to: $PROJECT_DIR/logs/"
echo ""
echo "To view logs:"
echo "  tail -f $PROJECT_DIR/logs/fmp_update_*.log"
echo ""
echo "To manually run the update:"
echo "  $CRON_SCRIPT"
echo ""
echo "Done!"