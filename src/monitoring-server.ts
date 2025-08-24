import express from 'express';
import { DatabaseClient } from './database.js';
import { getHealthMonitor } from './health-monitor.js';
import { FMPRateLimiter } from './fmp-rate-limiter.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * FMP System Monitoring Server
 * Provides real-time monitoring dashboard and API endpoints
 */
class MonitoringServer {
  private app: express.Application;
  private db: DatabaseClient;
  private healthMonitor: any;
  private rateLimiter: FMPRateLimiter;
  private server: any;
  private wss: WebSocketServer;
  private logWatchers: Map<string, any> = new Map();

  constructor(port: number = 3001) {
    this.app = express();
    this.db = new DatabaseClient();
    this.healthMonitor = getHealthMonitor();
    this.rateLimiter = new FMPRateLimiter();
    
    // Create HTTP server
    this.server = createServer(this.app);
    
    // Create WebSocket server for real-time updates
    this.wss = new WebSocketServer({ server: this.server });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    
    // Start server
    this.server.listen(port, () => {
      console.log(`🚀 Monitoring dashboard running at http://localhost:${port}`);
      console.log(`📊 API endpoints available at http://localhost:${port}/api`);
      console.log(`🔄 WebSocket available at ws://localhost:${port}`);
    });
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.static('public'));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', async (req, res) => {
      try {
        const health = await this.healthMonitor.getCurrentHealth();
        res.json(health);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // System metrics endpoint
    this.app.get('/api/metrics', async (req, res) => {
      try {
        await this.db.connect();
        
        // Get database metrics
        const dbMetrics = await this.db.query(`
          SELECT 
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'fmp') as table_count,
            (SELECT pg_database_size('fmpdata')) as db_size,
            (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = 'fmpdata') as connections,
            (SELECT MAX(check_time) FROM fmp.system_health) as last_health_check
        `);
        
        // Get data freshness
        const freshness = await this.db.query(`
          SELECT 
            'stock_prices' as table_name,
            COUNT(*) as row_count,
            MAX(created_at) as last_update
          FROM fmp.stock_prices
          UNION ALL
          SELECT 
            'real_time_quotes',
            COUNT(*),
            MAX(updated_at)
          FROM fmp.real_time_quotes
          UNION ALL
          SELECT 
            'news',
            COUNT(*),
            MAX(created_at)
          FROM fmp.news
          LIMIT 10
        `);
        
        // Get API usage
        const apiUsage = this.rateLimiter.getStats();
        
        res.json({
          database: dbMetrics.rows[0],
          freshness: freshness.rows,
          apiUsage,
          timestamp: new Date()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Recent errors endpoint
    this.app.get('/api/errors', async (req, res) => {
      try {
        await this.db.connect();
        
        const errors = await this.db.query(`
          SELECT 
            check_time,
            check_type,
            status,
            error_message,
            details
          FROM fmp.system_health
          WHERE status IN ('CRITICAL', 'WARNING')
          ORDER BY check_time DESC
          LIMIT 50
        `);
        
        res.json(errors.rows);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Table statistics endpoint
    this.app.get('/api/tables', async (req, res) => {
      try {
        await this.db.connect();
        
        const tables = await this.db.query(`
          SELECT 
            t.table_name,
            (xpath('/row/count/text()', 
             query_to_xml(format('SELECT COUNT(*) FROM fmp.%I', t.table_name), 
             true, true, '')))[1]::text::int as row_count,
            pg_size_pretty(pg_total_relation_size('fmp.' || t.table_name)) as size,
            obj_description(c.oid, 'pg_class') as description
          FROM information_schema.tables t
          JOIN pg_class c ON c.relname = t.table_name 
            AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'fmp')
          WHERE t.table_schema = 'fmp' 
          AND t.table_type = 'BASE TABLE'
          ORDER BY row_count DESC NULLS LAST
        `);
        
        res.json(tables.rows);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Logs endpoint
    this.app.get('/api/logs/:logType', (req, res) => {
      const logType = req.params.logType;
      const lines = parseInt(req.query.lines as string) || 100;
      
      const logFile = path.join(__dirname, '..', 'logs', `${logType}.log`);
      
      if (!fs.existsSync(logFile)) {
        return res.status(404).json({ error: 'Log file not found' });
      }
      
      // Read last N lines of log file
      const logs = this.readLastLines(logFile, lines);
      res.json({ logs, file: logFile });
    });

    // Job status endpoint
    this.app.get('/api/jobs', async (req, res) => {
      try {
        await this.db.connect();
        
        // Get failed jobs
        const failedJobs = await this.db.query(`
          SELECT * FROM fmp.failed_jobs
          ORDER BY last_error_at DESC
          LIMIT 20
        `);
        
        // Get recent update history
        const updateHistory = await this.db.query(`
          SELECT * FROM fmp.data_update_log
          ORDER BY created_at DESC
          LIMIT 20
        `);
        
        res.json({
          failed: failedJobs.rows,
          history: updateHistory.rows
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Serve monitoring dashboard
    this.app.get('/', (req, res) => {
      res.send(this.getDashboardHTML());
    });
  }

  /**
   * Setup WebSocket for real-time updates
   */
  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');
      
      // Send initial data
      this.sendRealtimeUpdate(ws);
      
      // Setup periodic updates
      const interval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          this.sendRealtimeUpdate(ws);
        }
      }, 5000); // Update every 5 seconds
      
      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        clearInterval(interval);
      });
      
      ws.on('message', async (message) => {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'subscribe-logs') {
          this.subscribeToLogs(ws, data.logType);
        }
      });
    });
  }

  /**
   * Send real-time update to WebSocket client
   */
  private async sendRealtimeUpdate(ws: WebSocket): Promise<void> {
    try {
      const health = await this.healthMonitor.getCurrentHealth();
      const apiStats = this.rateLimiter.getStats();
      
      ws.send(JSON.stringify({
        type: 'update',
        data: {
          health: health.overall,
          apiUsage: apiStats.currentMinuteCalls,
          apiRemaining: apiStats.remainingCallsThisMinute,
          timestamp: new Date()
        }
      }));
    } catch (error) {
      console.error('Error sending realtime update:', error);
    }
  }

  /**
   * Subscribe to log file changes
   */
  private subscribeToLogs(ws: WebSocket, logType: string): void {
    const logFile = path.join(__dirname, '..', 'logs', `${logType}.log`);
    
    if (!fs.existsSync(logFile)) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Log file not found'
      }));
      return;
    }
    
    // Watch log file for changes
    const watcher = fs.watch(logFile, (eventType) => {
      if (eventType === 'change') {
        const lastLine = this.readLastLines(logFile, 1);
        ws.send(JSON.stringify({
          type: 'log',
          logType,
          data: lastLine
        }));
      }
    });
    
    this.logWatchers.set(ws.toString(), watcher);
  }

  /**
   * Read last N lines from file
   */
  private readLastLines(filePath: string, lines: number): string {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const allLines = content.split('\n');
      return allLines.slice(-lines).join('\n');
    } catch (error) {
      return '';
    }
  }

  /**
   * Generate dashboard HTML
   */
  private getDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FMP System Monitor</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .card {
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s ease;
        }
        
        .card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
        }
        
        .card h2 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .metric:last-child {
            border-bottom: none;
        }
        
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        
        .metric-value {
            font-weight: bold;
            color: #333;
            font-size: 1.1em;
        }
        
        .status-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
        }
        
        .status-healthy {
            background: #10b981;
            color: white;
        }
        
        .status-warning {
            background: #f59e0b;
            color: white;
        }
        
        .status-critical {
            background: #ef4444;
            color: white;
        }
        
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #f0f0f0;
            border-radius: 10px;
            overflow: hidden;
            margin-top: 10px;
        }
        
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            border-radius: 10px;
            transition: width 0.3s ease;
        }
        
        .log-viewer {
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 15px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 0.85em;
            height: 200px;
            overflow-y: auto;
            margin-top: 10px;
        }
        
        .table-container {
            overflow-x: auto;
            margin-top: 10px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            background: #f7f7f7;
            padding: 10px;
            text-align: left;
            font-weight: 600;
            color: #666;
            border-bottom: 2px solid #e0e0e0;
        }
        
        td {
            padding: 10px;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .refresh-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9em;
            transition: opacity 0.3s;
        }
        
        .refresh-btn:hover {
            opacity: 0.9;
        }
        
        .icon {
            width: 24px;
            height: 24px;
            display: inline-block;
            vertical-align: middle;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }
        
        .loading {
            animation: pulse 1.5s infinite;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 FMP System Monitor</h1>
        
        <div class="dashboard">
            <!-- System Health Card -->
            <div class="card">
                <h2>
                    <span class="icon">💓</span>
                    System Health
                </h2>
                <div class="metric">
                    <span class="metric-label">Overall Status</span>
                    <span id="health-status" class="status-badge status-healthy">HEALTHY</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Database</span>
                    <span id="db-status" class="metric-value">Connected</span>
                </div>
                <div class="metric">
                    <span class="metric-label">API Status</span>
                    <span id="api-status" class="metric-value">Online</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Last Check</span>
                    <span id="last-check" class="metric-value">-</span>
                </div>
            </div>
            
            <!-- API Usage Card -->
            <div class="card">
                <h2>
                    <span class="icon">📊</span>
                    API Usage
                </h2>
                <div class="metric">
                    <span class="metric-label">Calls This Minute</span>
                    <span id="api-calls" class="metric-value">0</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Remaining</span>
                    <span id="api-remaining" class="metric-value">3000</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Usage</span>
                    <span id="api-usage-percent" class="metric-value">0%</span>
                </div>
                <div class="progress-bar">
                    <div id="api-progress" class="progress-fill" style="width: 0%"></div>
                </div>
            </div>
            
            <!-- Database Stats Card -->
            <div class="card">
                <h2>
                    <span class="icon">💾</span>
                    Database Statistics
                </h2>
                <div class="metric">
                    <span class="metric-label">Total Tables</span>
                    <span id="table-count" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Database Size</span>
                    <span id="db-size" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Active Connections</span>
                    <span id="db-connections" class="metric-value">-</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Total Records</span>
                    <span id="total-records" class="metric-value">-</span>
                </div>
            </div>
            
            <!-- Data Freshness Card -->
            <div class="card">
                <h2>
                    <span class="icon">🔄</span>
                    Data Freshness
                </h2>
                <div id="freshness-list">
                    <div class="metric">
                        <span class="metric-label">Loading...</span>
                        <span class="metric-value">-</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tables Overview -->
        <div class="card">
            <h2>
                <span class="icon">📋</span>
                Tables Overview
                <button class="refresh-btn" onclick="loadTables()" style="float: right;">Refresh</button>
            </h2>
            <div class="table-container">
                <table id="tables-list">
                    <thead>
                        <tr>
                            <th>Table Name</th>
                            <th>Row Count</th>
                            <th>Size</th>
                            <th>Description</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="4" style="text-align: center;">Loading...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        
        <!-- Recent Logs -->
        <div class="card" style="margin-top: 20px;">
            <h2>
                <span class="icon">📝</span>
                Recent Logs
                <select id="log-selector" onchange="loadLogs()" style="float: right; padding: 5px;">
                    <option value="incremental">Incremental Updates</option>
                    <option value="daily">Daily Updates</option>
                    <option value="weekly">Weekly Updates</option>
                    <option value="error">Errors</option>
                </select>
            </h2>
            <div id="log-viewer" class="log-viewer">
                <div>Loading logs...</div>
            </div>
        </div>
    </div>
    
    <script>
        let ws = null;
        
        // Initialize WebSocket connection
        function initWebSocket() {
            ws = new WebSocket('ws://localhost:3001');
            
            ws.onopen = () => {
                console.log('WebSocket connected');
                document.getElementById('health-status').className = 'status-badge status-healthy';
                document.getElementById('health-status').textContent = 'CONNECTED';
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'update') {
                    updateDashboard(data.data);
                } else if (data.type === 'log') {
                    appendLog(data.data);
                }
            };
            
            ws.onclose = () => {
                console.log('WebSocket disconnected');
                document.getElementById('health-status').className = 'status-badge status-critical';
                document.getElementById('health-status').textContent = 'DISCONNECTED';
                
                // Reconnect after 5 seconds
                setTimeout(initWebSocket, 5000);
            };
            
            ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        }
        
        // Update dashboard with real-time data
        function updateDashboard(data) {
            // Update health status
            const statusElement = document.getElementById('health-status');
            statusElement.textContent = data.health;
            statusElement.className = 'status-badge status-' + data.health.toLowerCase();
            
            // Update API usage
            document.getElementById('api-calls').textContent = data.apiUsage;
            document.getElementById('api-remaining').textContent = data.apiRemaining;
            
            const usagePercent = (data.apiUsage / 3000) * 100;
            document.getElementById('api-usage-percent').textContent = usagePercent.toFixed(1) + '%';
            document.getElementById('api-progress').style.width = usagePercent + '%';
            
            // Update last check time
            document.getElementById('last-check').textContent = new Date(data.timestamp).toLocaleTimeString();
        }
        
        // Load metrics
        async function loadMetrics() {
            try {
                const response = await fetch('/api/metrics');
                const data = await response.json();
                
                // Update database stats
                document.getElementById('table-count').textContent = data.database.table_count;
                document.getElementById('db-size').textContent = formatBytes(data.database.db_size);
                document.getElementById('db-connections').textContent = data.database.connections;
                
                // Update freshness
                const freshnessHtml = data.freshness.map(item => \`
                    <div class="metric">
                        <span class="metric-label">\${item.table_name}</span>
                        <span class="metric-value">\${item.row_count} rows</span>
                    </div>
                \`).join('');
                document.getElementById('freshness-list').innerHTML = freshnessHtml;
                
                // Calculate total records
                const totalRecords = data.freshness.reduce((sum, item) => sum + parseInt(item.row_count), 0);
                document.getElementById('total-records').textContent = totalRecords.toLocaleString();
            } catch (error) {
                console.error('Error loading metrics:', error);
            }
        }
        
        // Load tables
        async function loadTables() {
            try {
                const response = await fetch('/api/tables');
                const tables = await response.json();
                
                const tbody = document.querySelector('#tables-list tbody');
                tbody.innerHTML = tables.slice(0, 20).map(table => \`
                    <tr>
                        <td>\${table.table_name}</td>
                        <td>\${(table.row_count || 0).toLocaleString()}</td>
                        <td>\${table.size || '-'}</td>
                        <td>\${table.description || '-'}</td>
                    </tr>
                \`).join('');
            } catch (error) {
                console.error('Error loading tables:', error);
            }
        }
        
        // Load logs
        async function loadLogs() {
            const logType = document.getElementById('log-selector').value;
            
            try {
                const response = await fetch(\`/api/logs/\${logType}?lines=50\`);
                const data = await response.json();
                
                const logViewer = document.getElementById('log-viewer');
                logViewer.innerHTML = '<pre>' + (data.logs || 'No logs available') + '</pre>';
                logViewer.scrollTop = logViewer.scrollHeight;
            } catch (error) {
                document.getElementById('log-viewer').innerHTML = '<div>Error loading logs</div>';
            }
        }
        
        // Format bytes
        function formatBytes(bytes) {
            if (!bytes) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // Append log message
        function appendLog(message) {
            const logViewer = document.getElementById('log-viewer');
            const line = document.createElement('div');
            line.textContent = message;
            logViewer.appendChild(line);
            logViewer.scrollTop = logViewer.scrollHeight;
        }
        
        // Initialize dashboard
        function init() {
            initWebSocket();
            loadMetrics();
            loadTables();
            loadLogs();
            
            // Refresh metrics every 10 seconds
            setInterval(loadMetrics, 10000);
            
            // Refresh tables every 30 seconds
            setInterval(loadTables, 30000);
        }
        
        // Start when page loads
        window.addEventListener('load', init);
    </script>
</body>
</html>
    `;
  }
}

// Start monitoring server
const server = new MonitoringServer();

export { MonitoringServer };