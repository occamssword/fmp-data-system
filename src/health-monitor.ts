import { DatabaseClient } from './database.js';
import { FMPRateLimiter } from './fmp-rate-limiter.js';
import axios from 'axios';
import { config } from 'dotenv';
import os from 'os';

config();

/**
 * Health check types
 */
export enum HealthCheckType {
  DATABASE = 'DATABASE',
  API = 'API',
  DISK_SPACE = 'DISK_SPACE',
  MEMORY = 'MEMORY',
  DATA_FRESHNESS = 'DATA_FRESHNESS',
  RATE_LIMIT = 'RATE_LIMIT',
  ERROR_RATE = 'ERROR_RATE'
}

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Health check result
 */
interface HealthCheckResult {
  type: HealthCheckType;
  status: HealthStatus;
  message: string;
  details: any;
  responseTime: number;
  timestamp: Date;
}

/**
 * System metrics
 */
interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
  loadAverage: number[];
}

/**
 * Production Health Monitoring System
 */
export class HealthMonitor {
  private db: DatabaseClient;
  private rateLimiter: FMPRateLimiter;
  private checkInterval: NodeJS.Timeout | null = null;
  private alerts: Map<string, Date> = new Map();
  private metrics: SystemMetrics | null = null;

  constructor() {
    this.db = new DatabaseClient();
    this.rateLimiter = new FMPRateLimiter();
  }

  /**
   * Start health monitoring
   */
  async startMonitoring(intervalMs: number = 60000): Promise<void> {
    console.log(`Starting health monitoring (interval: ${intervalMs}ms)`);
    
    // Initial check
    await this.performHealthChecks();
    
    // Schedule periodic checks
    this.checkInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('Health monitoring stopped');
    }
  }

  /**
   * Perform all health checks
   */
  async performHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    try {
      // Parallel health checks
      const [
        dbHealth,
        apiHealth,
        diskHealth,
        memoryHealth,
        dataFreshness,
        rateLimitHealth,
        errorRateHealth
      ] = await Promise.all([
        this.checkDatabase(),
        this.checkAPI(),
        this.checkDiskSpace(),
        this.checkMemory(),
        this.checkDataFreshness(),
        this.checkRateLimit(),
        this.checkErrorRate()
      ]);
      
      results.push(dbHealth, apiHealth, diskHealth, memoryHealth, 
                   dataFreshness, rateLimitHealth, errorRateHealth);
      
      // Update system metrics
      this.metrics = await this.collectSystemMetrics();
      
      // Log results to database
      await this.logHealthChecks(results);
      
      // Check for alerts
      await this.checkAlerts(results);
      
      // Print summary
      this.printHealthSummary(results);
      
    } catch (error) {
      console.error('Error performing health checks:', error);
    }
    
    return results;
  }

  /**
   * Check database health
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let message = 'Database connection is healthy';
    let details: any = {};
    
    try {
      // Test connection
      await this.db.connect();
      
      // Check connection pool
      const poolStats = {
        totalCount: this.db.pool.totalCount,
        idleCount: this.db.pool.idleCount,
        waitingCount: this.db.pool.waitingCount
      };
      
      // Check table counts
      const tableCount = await this.db.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'fmp'
      `);
      
      // Check database size
      const dbSize = await this.db.query(`
        SELECT pg_database_size('fmpdata') as size
      `);
      
      details = {
        poolStats,
        tableCount: tableCount.rows[0].count,
        databaseSize: `${(dbSize.rows[0].size / 1024 / 1024).toFixed(2)} MB`,
        connectionTime: Date.now() - startTime
      };
      
      // Check for warnings
      if (poolStats.waitingCount > 5) {
        status = HealthStatus.WARNING;
        message = 'High database connection pool usage';
      }
      
    } catch (error: any) {
      status = HealthStatus.CRITICAL;
      message = `Database connection failed: ${error.message}`;
      details = { error: error.message };
    }
    
    return {
      type: HealthCheckType.DATABASE,
      status,
      message,
      details,
      responseTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Check API health
   */
  async checkAPI(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let message = 'FMP API is accessible';
    let details: any = {};
    
    try {
      // Test API endpoint
      const response = await axios.get(
        'https://financialmodelingprep.com/api/v3/quote/AAPL',
        {
          params: { apikey: process.env.FMP_API_KEY },
          timeout: 5000
        }
      );
      
      if (response.status === 200) {
        details = {
          statusCode: response.status,
          responseTime: Date.now() - startTime,
          dataReceived: true
        };
      } else {
        status = HealthStatus.WARNING;
        message = `API returned status ${response.status}`;
      }
      
    } catch (error: any) {
      if (error.response?.status === 429) {
        status = HealthStatus.WARNING;
        message = 'API rate limit reached';
      } else {
        status = HealthStatus.CRITICAL;
        message = `API connection failed: ${error.message}`;
      }
      details = { error: error.message };
    }
    
    return {
      type: HealthCheckType.API,
      status,
      message,
      details,
      responseTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Check disk space
   */
  async checkDiskSpace(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let message = 'Disk space is sufficient';
    let details: any = {};
    
    try {
      // Get disk usage (this is a simplified version)
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const usedPercent = ((totalMemory - freeMemory) / totalMemory * 100);
      
      details = {
        totalSpace: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        freeSpace: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
        usedPercent: `${usedPercent.toFixed(1)}%`
      };
      
      if (usedPercent > 90) {
        status = HealthStatus.CRITICAL;
        message = 'Disk space critically low';
      } else if (usedPercent > 80) {
        status = HealthStatus.WARNING;
        message = 'Disk space running low';
      }
      
    } catch (error: any) {
      status = HealthStatus.UNKNOWN;
      message = 'Could not check disk space';
      details = { error: error.message };
    }
    
    return {
      type: HealthCheckType.DISK_SPACE,
      status,
      message,
      details,
      responseTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Check memory usage
   */
  async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let message = 'Memory usage is normal';
    
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usedPercent = (usedMemory / totalMemory * 100);
    
    const details = {
      totalMemory: `${(totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
      freeMemory: `${(freeMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
      usedMemory: `${(usedMemory / 1024 / 1024 / 1024).toFixed(2)} GB`,
      usedPercent: `${usedPercent.toFixed(1)}%`,
      processMemory: process.memoryUsage()
    };
    
    if (usedPercent > 90) {
      status = HealthStatus.CRITICAL;
      message = 'Memory usage critically high';
    } else if (usedPercent > 80) {
      status = HealthStatus.WARNING;
      message = 'Memory usage is high';
    }
    
    return {
      type: HealthCheckType.MEMORY,
      status,
      message,
      details,
      responseTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Check data freshness
   */
  async checkDataFreshness(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let message = 'Data is up to date';
    let details: any = {};
    
    try {
      // Check when key tables were last updated
      const freshness = await this.db.query(`
        SELECT 
          'stock_prices' as table_name,
          MAX(created_at) as last_update,
          EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))/3600 as hours_old
        FROM fmp.stock_prices
        UNION ALL
        SELECT 
          'companies' as table_name,
          MAX(updated_at) as last_update,
          EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))/3600 as hours_old
        FROM fmp.companies
        UNION ALL
        SELECT 
          'real_time_quotes' as table_name,
          MAX(updated_at) as last_update,
          EXTRACT(EPOCH FROM (NOW() - MAX(updated_at)))/3600 as hours_old
        FROM fmp.real_time_quotes
      `);
      
      details.tables = {};
      let maxHoursOld = 0;
      
      for (const row of freshness.rows) {
        details.tables[row.table_name] = {
          lastUpdate: row.last_update,
          hoursOld: row.hours_old ? parseFloat(row.hours_old).toFixed(1) : 'Never'
        };
        
        if (row.hours_old && row.hours_old > maxHoursOld) {
          maxHoursOld = row.hours_old;
        }
      }
      
      if (maxHoursOld > 48) {
        status = HealthStatus.CRITICAL;
        message = 'Data is stale (>48 hours old)';
      } else if (maxHoursOld > 24) {
        status = HealthStatus.WARNING;
        message = 'Some data is outdated (>24 hours old)';
      }
      
    } catch (error: any) {
      status = HealthStatus.UNKNOWN;
      message = 'Could not check data freshness';
      details = { error: error.message };
    }
    
    return {
      type: HealthCheckType.DATA_FRESHNESS,
      status,
      message,
      details,
      responseTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Check rate limit status
   */
  async checkRateLimit(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let message = 'Rate limits are healthy';
    
    const stats = this.rateLimiter.getStats();
    const usagePercent = (stats.currentMinuteCalls / 3000) * 100;
    
    const details = {
      callsInLastMinute: stats.callsInLastMinute,
      currentMinuteCalls: stats.currentMinuteCalls,
      remainingCalls: stats.remainingCallsThisMinute,
      usagePercent: `${usagePercent.toFixed(1)}%`,
      avgResponseTime: `${stats.avgResponseTime}ms`
    };
    
    if (usagePercent > 90) {
      status = HealthStatus.CRITICAL;
      message = 'Rate limit nearly exceeded';
    } else if (usagePercent > 70) {
      status = HealthStatus.WARNING;
      message = 'High API usage';
    }
    
    return {
      type: HealthCheckType.RATE_LIMIT,
      status,
      message,
      details,
      responseTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Check error rate
   */
  async checkErrorRate(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status = HealthStatus.HEALTHY;
    let message = 'Error rate is normal';
    let details: any = {};
    
    try {
      // Check recent errors
      const errors = await this.db.query(`
        SELECT 
          COUNT(*) as total_errors,
          COUNT(CASE WHEN check_time > NOW() - INTERVAL '1 hour' THEN 1 END) as last_hour,
          COUNT(CASE WHEN check_time > NOW() - INTERVAL '24 hours' THEN 1 END) as last_day
        FROM fmp.system_health
        WHERE status IN ('HIGH', 'CRITICAL')
      `);
      
      const failedJobs = await this.db.query(`
        SELECT COUNT(*) as count FROM fmp.failed_jobs
        WHERE next_retry_at > CURRENT_TIMESTAMP
      `);
      
      details = {
        totalErrors: errors.rows[0].total_errors,
        errorsLastHour: errors.rows[0].last_hour,
        errorsLastDay: errors.rows[0].last_day,
        pendingRetries: failedJobs.rows[0].count
      };
      
      if (errors.rows[0].last_hour > 10) {
        status = HealthStatus.CRITICAL;
        message = 'High error rate detected';
      } else if (errors.rows[0].last_hour > 5) {
        status = HealthStatus.WARNING;
        message = 'Elevated error rate';
      }
      
    } catch (error: any) {
      status = HealthStatus.UNKNOWN;
      message = 'Could not check error rate';
      details = { error: error.message };
    }
    
    return {
      type: HealthCheckType.ERROR_RATE,
      status,
      message,
      details,
      responseTime: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    return {
      cpuUsage: os.loadavg()[0],
      memoryUsage: (1 - os.freemem() / os.totalmem()) * 100,
      diskUsage: 0, // Would need additional library for accurate disk usage
      uptime: os.uptime(),
      loadAverage: os.loadavg()
    };
  }

  /**
   * Log health checks to database
   */
  async logHealthChecks(results: HealthCheckResult[]): Promise<void> {
    try {
      for (const result of results) {
        await this.db.query(`
          INSERT INTO fmp.system_health (
            check_type, status, details, 
            response_time_ms, error_message
          ) VALUES ($1, $2, $3, $4, $5)
        `, [
          result.type,
          result.status,
          result.details,
          result.responseTime,
          result.status === HealthStatus.CRITICAL ? result.message : null
        ]);
      }
    } catch (error) {
      console.error('Failed to log health checks:', error);
    }
  }

  /**
   * Check for alerts
   */
  async checkAlerts(results: HealthCheckResult[]): Promise<void> {
    for (const result of results) {
      if (result.status === HealthStatus.CRITICAL) {
        const lastAlert = this.alerts.get(result.type);
        const now = new Date();
        
        // Only alert once per hour for the same issue
        if (!lastAlert || (now.getTime() - lastAlert.getTime()) > 3600000) {
          console.error(`🚨 CRITICAL ALERT: ${result.type} - ${result.message}`);
          this.alerts.set(result.type, now);
          
          // Here you would send actual alerts (email, Slack, PagerDuty, etc.)
          // await this.sendAlert(result);
        }
      }
    }
  }

  /**
   * Print health summary
   */
  printHealthSummary(results: HealthCheckResult[]): void {
    const statusEmoji = {
      [HealthStatus.HEALTHY]: '✅',
      [HealthStatus.WARNING]: '⚠️',
      [HealthStatus.CRITICAL]: '🔴',
      [HealthStatus.UNKNOWN]: '❓'
    };
    
    console.log('\n=== SYSTEM HEALTH CHECK ===');
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('---------------------------');
    
    for (const result of results) {
      console.log(`${statusEmoji[result.status]} ${result.type}: ${result.message}`);
    }
    
    if (this.metrics) {
      console.log('---------------------------');
      console.log(`CPU Load: ${this.metrics.cpuUsage.toFixed(2)}`);
      console.log(`Memory: ${this.metrics.memoryUsage.toFixed(1)}%`);
      console.log(`Uptime: ${(this.metrics.uptime / 3600).toFixed(1)} hours`);
    }
    
    console.log('===========================\n');
  }

  /**
   * Get current health status
   */
  async getCurrentHealth(): Promise<{
    overall: HealthStatus;
    checks: HealthCheckResult[];
    metrics: SystemMetrics | null;
  }> {
    const checks = await this.performHealthChecks();
    
    // Determine overall status
    let overall = HealthStatus.HEALTHY;
    for (const check of checks) {
      if (check.status === HealthStatus.CRITICAL) {
        overall = HealthStatus.CRITICAL;
        break;
      } else if (check.status === HealthStatus.WARNING && overall === HealthStatus.HEALTHY) {
        overall = HealthStatus.WARNING;
      }
    }
    
    return {
      overall,
      checks,
      metrics: this.metrics
    };
  }
}

// Export singleton instance
let healthMonitor: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new HealthMonitor();
  }
  return healthMonitor;
}

export default HealthMonitor;