import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * FMP API Rate Limiter and Data Loader
 * 
 * API Limits: 3000 requests per minute
 * Strategy: 
 * - Max 50 requests per second (3000/60 = 50)
 * - Batch requests when possible
 * - Track API calls and pause when approaching limits
 * - Log all API usage for monitoring
 */

interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxRequestsPerSecond: number;
  burstSize: number;
  retryAttempts: number;
  retryDelay: number;
}

interface APICallLog {
  timestamp: Date;
  endpoint: string;
  success: boolean;
  responseTime: number;
}

class FMPRateLimiter {
  private config: RateLimiterConfig;
  private callLog: APICallLog[] = [];
  private currentMinuteCalls: number = 0;
  private currentSecondCalls: number = 0;
  private lastMinuteReset: Date = new Date();
  private lastSecondReset: Date = new Date();
  private axiosInstance: AxiosInstance;
  private apiKey: string;
  
  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FMP_API_KEY || '';
    
    // Conservative limits to stay well under 3000/minute
    this.config = {
      maxRequestsPerMinute: 2800,  // Leave buffer of 200
      maxRequestsPerSecond: 45,    // Leave buffer of 5 per second
      burstSize: 10,               // Max burst of 10 requests
      retryAttempts: 3,
      retryDelay: 2000
    };
    
    this.axiosInstance = axios.create({
      baseURL: 'https://financialmodelingprep.com/api/v3',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  /**
   * Check if we can make a request based on rate limits
   */
  private async checkRateLimit(): Promise<boolean> {
    const now = new Date();
    
    // Reset minute counter if needed
    if (now.getTime() - this.lastMinuteReset.getTime() >= 60000) {
      this.currentMinuteCalls = 0;
      this.lastMinuteReset = now;
      console.log(`[Rate Limiter] Minute reset. Total calls in last minute: ${this.currentMinuteCalls}`);
    }
    
    // Reset second counter if needed
    if (now.getTime() - this.lastSecondReset.getTime() >= 1000) {
      this.currentSecondCalls = 0;
      this.lastSecondReset = now;
    }
    
    // Check limits
    if (this.currentMinuteCalls >= this.config.maxRequestsPerMinute) {
      const waitTime = 60000 - (now.getTime() - this.lastMinuteReset.getTime());
      console.log(`[Rate Limiter] Minute limit reached. Waiting ${Math.ceil(waitTime/1000)}s...`);
      await this.sleep(waitTime);
      return this.checkRateLimit(); // Recursive check after wait
    }
    
    if (this.currentSecondCalls >= this.config.maxRequestsPerSecond) {
      const waitTime = 1000 - (now.getTime() - this.lastSecondReset.getTime());
      if (waitTime > 0) {
        await this.sleep(waitTime);
        return this.checkRateLimit();
      }
    }
    
    return true;
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Make a rate-limited API call
   */
  async makeRequest(endpoint: string, params?: any): Promise<any> {
    await this.checkRateLimit();
    
    const startTime = Date.now();
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        // Increment counters
        this.currentMinuteCalls++;
        this.currentSecondCalls++;
        
        // Make request
        const response = await this.axiosInstance.get(endpoint, {
          params: {
            ...params,
            apikey: this.apiKey
          }
        });
        
        // Log successful call
        this.callLog.push({
          timestamp: new Date(),
          endpoint,
          success: true,
          responseTime: Date.now() - startTime
        });
        
        // Small delay between requests to be nice to the API
        await this.sleep(20); // 20ms between requests
        
        return response.data;
        
      } catch (error: any) {
        lastError = error;
        
        // Log failed call
        this.callLog.push({
          timestamp: new Date(),
          endpoint,
          success: false,
          responseTime: Date.now() - startTime
        });
        
        if (error.response?.status === 429) {
          console.log(`[Rate Limiter] 429 Too Many Requests. Waiting 60s...`);
          await this.sleep(60000);
        } else if (attempt < this.config.retryAttempts) {
          console.log(`[Rate Limiter] Request failed (attempt ${attempt}/${this.config.retryAttempts}). Retrying...`);
          await this.sleep(this.config.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }
  
  /**
   * Batch process multiple symbols efficiently
   */
  async batchProcess<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    batchSize: number = 10
  ): Promise<any[]> {
    const results: any[] = [];
    const totalBatches = Math.ceil(items.length / batchSize);
    
    console.log(`[Batch Processor] Processing ${items.length} items in ${totalBatches} batches of ${batchSize}`);
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      console.log(`[Batch Processor] Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)`);
      
      // Process batch in parallel but respect rate limits
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      );
      
      results.push(...batchResults);
      
      // Show progress
      const progress = ((i + batch.length) / items.length * 100).toFixed(1);
      console.log(`[Batch Processor] Progress: ${progress}% (${i + batch.length}/${items.length})`);
      
      // Pause between batches to respect rate limits
      if (i + batchSize < items.length) {
        await this.sleep(1000); // 1 second between batches
      }
    }
    
    return results;
  }
  
  /**
   * Get API usage statistics
   */
  getStats() {
    const recentCalls = this.callLog.filter(
      log => log.timestamp.getTime() > Date.now() - 60000
    );
    
    const successfulCalls = recentCalls.filter(log => log.success).length;
    const failedCalls = recentCalls.filter(log => !log.success).length;
    const avgResponseTime = recentCalls.length > 0
      ? recentCalls.reduce((sum, log) => sum + log.responseTime, 0) / recentCalls.length
      : 0;
    
    return {
      callsInLastMinute: recentCalls.length,
      successfulCalls,
      failedCalls,
      avgResponseTime: Math.round(avgResponseTime),
      currentMinuteCalls: this.currentMinuteCalls,
      remainingCallsThisMinute: this.config.maxRequestsPerMinute - this.currentMinuteCalls
    };
  }
  
  /**
   * Clear old logs to prevent memory issues
   */
  cleanupLogs() {
    const fiveMinutesAgo = Date.now() - 300000;
    this.callLog = this.callLog.filter(
      log => log.timestamp.getTime() > fiveMinutesAgo
    );
  }
}

/**
 * FMP Data Loader with Rate Limiting
 */
export class FMPDataLoader {
  public rateLimiter: FMPRateLimiter;
  private pool: Pool;
  
  constructor(pool?: Pool) {
    this.rateLimiter = new FMPRateLimiter();
    this.pool = pool || new Pool({
      host: 'localhost',
      port: 5432,
      database: 'FMPData',
      user: 'parthbhatt',
      password: ''
    });
  }
  
  /**
   * Load company profiles with rate limiting
   */
  async loadCompanyProfiles(symbols: string[]) {
    console.log(`\n[FMP Loader] Loading ${symbols.length} company profiles...`);
    const startTime = Date.now();
    
    const processor = async (symbol: string) => {
      try {
        const data = await this.rateLimiter.makeRequest(`/profile/${symbol}`);
        
        if (data && data.length > 0) {
          const company = data[0];
          
          const query = `
            INSERT INTO fmp.companies (
              symbol, name, exchange, exchange_short_name, sector, industry,
              country, market_cap, employees, website, description, ceo, ipo_date
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (symbol) DO UPDATE SET
              name = EXCLUDED.name,
              market_cap = EXCLUDED.market_cap,
              updated_at = CURRENT_TIMESTAMP
          `;
          
          await this.pool.query(query, [
            company.symbol,
            company.companyName,
            company.exchange,
            company.exchangeShortName,
            company.sector,
            company.industry,
            company.country,
            company.mktCap,
            company.fullTimeEmployees,
            company.website,
            company.description,
            company.ceo,
            company.ipoDate ? new Date(company.ipoDate) : null
          ]);
          
          return { symbol, success: true };
        }
        return { symbol, success: false, reason: 'No data' };
        
      } catch (error: any) {
        console.error(`[FMP Loader] Error loading ${symbol}: ${error.message}`);
        return { symbol, success: false, error: error.message };
      }
    };
    
    const results = await this.rateLimiter.batchProcess(symbols, processor, 10);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const successful = results.filter(r => r.success).length;
    
    console.log(`[FMP Loader] Completed in ${elapsed}s. Success: ${successful}/${symbols.length}`);
    console.log(`[FMP Loader] API Stats:`, this.rateLimiter.getStats());
    
    return results;
  }
  
  /**
   * Load historical prices with rate limiting
   */
  async loadHistoricalPrices(symbol: string, from?: string, to?: string) {
    console.log(`[FMP Loader] Loading historical prices for ${symbol}...`);
    
    try {
      const params: any = {};
      if (from) params.from = from;
      if (to) params.to = to;
      
      const data = await this.rateLimiter.makeRequest(
        `/historical-price-full/${symbol}`,
        params
      );
      
      if (!data || !data.historical) {
        console.log(`[FMP Loader] No historical data for ${symbol}`);
        return { symbol, success: false, count: 0 };
      }
      
      // Batch insert for efficiency
      const values: any[] = [];
      const placeholders: string[] = [];
      let paramCount = 1;
      
      data.historical.forEach((price: any) => {
        placeholders.push(`($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`);
        values.push(
          symbol,
          new Date(price.date),
          price.open,
          price.high,
          price.low,
          price.close,
          price.adjClose,
          price.volume,
          price.unadjustedVolume,
          price.change,
          price.changePercent,
          price.vwap
        );
      });
      
      if (placeholders.length > 0) {
        const query = `
          INSERT INTO fmp.stock_prices (
            symbol, date, open, high, low, close, adj_close, 
            volume, unadjusted_volume, change, change_percent, vwap
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (symbol, date) DO UPDATE SET
            close = EXCLUDED.close,
            volume = EXCLUDED.volume
        `;
        
        await this.pool.query(query, values);
      }
      
      console.log(`[FMP Loader] Loaded ${data.historical.length} price records for ${symbol}`);
      return { symbol, success: true, count: data.historical.length };
      
    } catch (error: any) {
      console.error(`[FMP Loader] Error loading prices for ${symbol}: ${error.message}`);
      return { symbol, success: false, error: error.message };
    }
  }
  
  /**
   * Load financial statements with rate limiting
   */
  async loadFinancialStatements(symbols: string[], statementType: 'income' | 'balance' | 'cash-flow', period: 'annual' | 'quarter' = 'annual') {
    console.log(`\n[FMP Loader] Loading ${period} ${statementType} statements for ${symbols.length} symbols...`);
    
    const endpoint = statementType === 'income' ? '/income-statement' :
                     statementType === 'balance' ? '/balance-sheet-statement' :
                     '/cash-flow-statement';
    
    const processor = async (symbol: string) => {
      try {
        const data = await this.rateLimiter.makeRequest(
          `${endpoint}/${symbol}`,
          { period, limit: 10 }
        );
        
        if (!data || data.length === 0) {
          return { symbol, success: false, reason: 'No data' };
        }
        
        // Process based on statement type
        // (Implementation would vary based on statement type)
        console.log(`[FMP Loader] Loaded ${data.length} ${statementType} statements for ${symbol}`);
        return { symbol, success: true, count: data.length };
        
      } catch (error: any) {
        return { symbol, success: false, error: error.message };
      }
    };
    
    return await this.rateLimiter.batchProcess(symbols, processor, 5);
  }
  
  /**
   * Monitor API usage
   */
  startMonitoring(intervalMs: number = 10000) {
    setInterval(() => {
      const stats = this.rateLimiter.getStats();
      console.log(`[API Monitor] Calls: ${stats.currentMinuteCalls}/${stats.currentMinuteCalls + stats.remainingCallsThisMinute} | Avg Response: ${stats.avgResponseTime}ms`);
      this.rateLimiter.cleanupLogs();
    }, intervalMs);
  }
  
  /**
   * Close database connection
   */
  async close() {
    await this.pool.end();
  }
}

// Example usage and exports
export { FMPRateLimiter };

// Main function for testing
async function main() {
  const loader = new FMPDataLoader();
  
  // Start monitoring
  loader.startMonitoring();
  
  // Example: Load S&P 500 companies
  const testSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'];
  
  console.log('='.repeat(60));
  console.log('FMP Data Loader with Rate Limiting');
  console.log('API Limit: 3000 requests per minute');
  console.log('='.repeat(60));
  
  // Load company profiles
  await loader.loadCompanyProfiles(testSymbols);
  
  // Load historical prices for each
  for (const symbol of testSymbols) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    
    await loader.loadHistoricalPrices(
      symbol,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }
  
  await loader.close();
}

// Run if called directly
// main().catch(console.error);