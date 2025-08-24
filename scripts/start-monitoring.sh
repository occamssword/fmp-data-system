#!/bin/bash

# FMP System Monitoring Dashboard Launcher

echo "=========================================="
echo "FMP SYSTEM MONITORING DASHBOARD"
echo "=========================================="
echo ""

# Check if monitoring server is already running
if pgrep -f "monitoring-server.js" > /dev/null; then
    echo "✓ Monitoring server is already running"
else
    echo "Starting monitoring server..."
    node dist/src/monitoring-server.js &
    sleep 2
    echo "✓ Monitoring server started"
fi

echo ""
echo "Dashboard URLs:"
echo "----------------------------------------"
echo "📊 Main Dashboard: http://localhost:3001"
echo "🔧 API Metrics:    http://localhost:3001/api/metrics"
echo "📋 Tables Info:    http://localhost:3001/api/tables"
echo "💓 Health Check:   http://localhost:3001/api/health"
echo "📝 Logs Viewer:    http://localhost:3001/api/logs/incremental"
echo "----------------------------------------"
echo ""

# Open dashboard in browser (macOS)
if command -v open &> /dev/null; then
    echo "Opening dashboard in browser..."
    open http://localhost:3001
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:3001
elif command -v start &> /dev/null; then
    # Windows
    start http://localhost:3001
else
    echo "Please open http://localhost:3001 in your browser"
fi

echo ""
echo "Press Ctrl+C to stop monitoring (dashboard will continue running)"
echo "To stop the server completely, run: pkill -f monitoring-server.js"
echo ""

# Keep script running to show logs
tail -f logs/incremental.log 2>/dev/null || echo "Waiting for logs..."