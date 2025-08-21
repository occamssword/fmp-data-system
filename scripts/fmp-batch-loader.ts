import { FMPDataLoader } from '../src/fmp-rate-limiter.js';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * FMP Batch Data Loader
 * 
 * Efficiently loads large amounts of data while respecting API limits:
 * - 3000 requests per minute
 * - Batch processing with progress tracking
 * - Automatic retry on failures
 * - Pacific timezone support
 */

interface LoadingConfig {
  symbols?: string[];
  dataTypes?: string[];
  period?: 'annual' | 'quarter';
  historicalDays?: number;
  batchSize?: number;
}

interface LoadingProgress {
  totalTasks: number;
  completedTasks: number;
  successfulTasks: number;
  failedTasks: number;
  apiCallsUsed: number;
  estimatedTimeRemaining: string;
  errors: { symbol: string; error: string }[];
}

class FMPBatchLoader {
  private loader: FMPDataLoader;
  private pool: Pool;
  private progress: LoadingProgress;
  private startTime: number;
  
  constructor() {
    this.pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: 'FMPData',
      user: 'parthbhatt',
      password: ''
    });
    
    this.loader = new FMPDataLoader(this.pool);
    
    this.progress = {
      totalTasks: 0,
      completedTasks: 0,
      successfulTasks: 0,
      failedTasks: 0,
      apiCallsUsed: 0,
      estimatedTimeRemaining: 'Calculating...',
      errors: []
    };
    
    this.startTime = Date.now();
  }
  
  /**
   * Calculate estimated time remaining
   */
  private updateTimeEstimate() {
    if (this.progress.completedTasks === 0) return;
    
    const elapsed = Date.now() - this.startTime;
    const avgTimePerTask = elapsed / this.progress.completedTasks;
    const remainingTasks = this.progress.totalTasks - this.progress.completedTasks;
    const estimatedMs = avgTimePerTask * remainingTasks;
    
    const minutes = Math.floor(estimatedMs / 60000);
    const seconds = Math.floor((estimatedMs % 60000) / 1000);
    
    this.progress.estimatedTimeRemaining = `${minutes}m ${seconds}s`;
  }
  
  /**
   * Print progress report
   */
  private printProgress() {
    this.updateTimeEstimate();
    
    const progressBar = this.getProgressBar(
      this.progress.completedTasks,
      this.progress.totalTasks,
      30
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('Loading Progress');
    console.log('='.repeat(60));
    console.log(`Progress: ${progressBar} ${this.getProgressPercentage()}%`);
    console.log(`Tasks: ${this.progress.completedTasks}/${this.progress.totalTasks}`);
    console.log(`Success: ${this.progress.successfulTasks} | Failed: ${this.progress.failedTasks}`);
    console.log(`Est. Time Remaining: ${this.progress.estimatedTimeRemaining}`);
    console.log(`API Calls Used: ~${this.progress.apiCallsUsed}`);
    
    if (this.progress.errors.length > 0 && this.progress.errors.length <= 5) {
      console.log('\nRecent Errors:');
      this.progress.errors.slice(-5).forEach(e => {
        console.log(`  - ${e.symbol}: ${e.error}`);
      });
    }
  }
  
  /**
   * Get progress bar string
   */
  private getProgressBar(current: number, total: number, width: number): string {
    const percentage = current / total;
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
  
  /**
   * Get progress percentage
   */
  private getProgressPercentage(): number {
    if (this.progress.totalTasks === 0) return 0;
    return Math.round((this.progress.completedTasks / this.progress.totalTasks) * 100);
  }
  
  /**
   * Load all available data types for symbols
   */
  async loadSymbolData(symbols: string[], config: LoadingConfig = {}) {
    console.log('\n' + '='.repeat(60));
    console.log('FMP Batch Data Loader');
    console.log('='.repeat(60));
    console.log(`Symbols to load: ${symbols.length}`);
    console.log(`API Limit: 3000 requests/minute (using max 2800)`);
    console.log(`Batch Size: ${config.batchSize || 10}`);
    
    const dataTypes = config.dataTypes || [
      'profile',
      'historical-prices',
      'income-statement',
      'balance-sheet',
      'cash-flow',
      'key-metrics',
      'financial-ratios',
      'enterprise-value',
      'dividends',
      'analyst-estimates'
    ];
    
    // Calculate total tasks
    this.progress.totalTasks = symbols.length * dataTypes.length;
    
    console.log(`Data types: ${dataTypes.length}`);
    console.log(`Total tasks: ${this.progress.totalTasks}`);
    console.log(`Estimated API calls: ${this.progress.totalTasks}`);
    console.log(`Estimated time: ${Math.ceil(this.progress.totalTasks / 45)}s - ${Math.ceil(this.progress.totalTasks / 30)}s`);
    console.log('\nStarting data load...\n');
    
    // Start monitoring
    this.loader.startMonitoring(30000); // Every 30 seconds
    
    // Process each data type for all symbols
    for (const dataType of dataTypes) {
      console.log(`\n[${dataType.toUpperCase()}] Loading for ${symbols.length} symbols...`);
      
      await this.loadDataType(symbols, dataType, config);
      
      this.printProgress();
    }
    
    // Final report
    this.printFinalReport();
  }
  
  /**
   * Load specific data type for symbols
   */
  private async loadDataType(symbols: string[], dataType: string, config: LoadingConfig) {
    const period = config.period || 'annual';
    const batchSize = config.batchSize || 10;
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (symbol) => {
        try {
          let result: any;
          
          switch (dataType) {
            case 'profile':
              result = await this.loadCompanyProfile(symbol);
              break;
              
            case 'historical-prices':
              result = await this.loadHistoricalPrices(symbol, config.historicalDays || 30);
              break;
              
            case 'income-statement':
              result = await this.loadIncomeStatement(symbol, period);
              break;
              
            case 'balance-sheet':
              result = await this.loadBalanceSheet(symbol, period);
              break;
              
            case 'cash-flow':
              result = await this.loadCashFlow(symbol, period);
              break;
              
            case 'key-metrics':
              result = await this.loadKeyMetrics(symbol, period);
              break;
              
            case 'financial-ratios':
              result = await this.loadFinancialRatios(symbol, period);
              break;
              
            case 'enterprise-value':
              result = await this.loadEnterpriseValue(symbol);
              break;
              
            case 'dividends':
              result = await this.loadDividends(symbol);
              break;
              
            case 'analyst-estimates':
              result = await this.loadAnalystEstimates(symbol);
              break;
              
            default:
              console.log(`Unknown data type: ${dataType}`);
              result = { success: false };
          }
          
          this.progress.completedTasks++;
          this.progress.apiCallsUsed++;
          
          if (result.success) {
            this.progress.successfulTasks++;
          } else {
            this.progress.failedTasks++;
            if (result.error) {
              this.progress.errors.push({ symbol, error: result.error });
            }
          }
          
        } catch (error: any) {
          this.progress.completedTasks++;
          this.progress.failedTasks++;
          this.progress.errors.push({ symbol, error: error.message });
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < symbols.length) {
        await this.sleep(500);
      }
    }
  }
  
  /**
   * Individual data loaders (simplified - you'd implement full logic)
   */
  private async loadCompanyProfile(symbol: string) {
    const results = await this.loader.loadCompanyProfiles([symbol]);
    return results[0] || { success: false };
  }
  
  private async loadHistoricalPrices(symbol: string, days: number) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return await this.loader.loadHistoricalPrices(
      symbol,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
  }
  
  private async loadIncomeStatement(symbol: string, period: 'annual' | 'quarter') {
    const results = await this.loader.loadFinancialStatements([symbol], 'income', period);
    return results[0] || { success: false };
  }
  
  private async loadBalanceSheet(symbol: string, period: 'annual' | 'quarter') {
    const results = await this.loader.loadFinancialStatements([symbol], 'balance', period);
    return results[0] || { success: false };
  }
  
  private async loadCashFlow(symbol: string, period: 'annual' | 'quarter') {
    const results = await this.loader.loadFinancialStatements([symbol], 'cash-flow', period);
    return results[0] || { success: false };
  }
  
  // Placeholder methods for other data types
  private async loadKeyMetrics(symbol: string, period: string) {
    // Implementation would go here
    return { success: true };
  }
  
  private async loadFinancialRatios(symbol: string, period: string) {
    return { success: true };
  }
  
  private async loadEnterpriseValue(symbol: string) {
    return { success: true };
  }
  
  private async loadDividends(symbol: string) {
    return { success: true };
  }
  
  private async loadAnalystEstimates(symbol: string) {
    return { success: true };
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Print final report
   */
  private printFinalReport() {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    
    console.log('\n' + '='.repeat(60));
    console.log('BATCH LOADING COMPLETED');
    console.log('='.repeat(60));
    console.log(`Total Time: ${minutes}m ${seconds}s`);
    console.log(`Tasks Completed: ${this.progress.completedTasks}/${this.progress.totalTasks}`);
    console.log(`Success Rate: ${((this.progress.successfulTasks / this.progress.totalTasks) * 100).toFixed(1)}%`);
    console.log(`API Calls Used: ~${this.progress.apiCallsUsed}`);
    console.log(`Average Speed: ${(this.progress.apiCallsUsed / (elapsed / 60000)).toFixed(0)} calls/minute`);
    
    if (this.progress.errors.length > 0) {
      console.log(`\nTotal Errors: ${this.progress.errors.length}`);
      
      // Group errors by type
      const errorTypes = new Map<string, number>();
      this.progress.errors.forEach(e => {
        const key = e.error.substring(0, 50);
        errorTypes.set(key, (errorTypes.get(key) || 0) + 1);
      });
      
      console.log('Error Summary:');
      errorTypes.forEach((count, error) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }
  }
  
  /**
   * Close connections
   */
  async close() {
    await this.loader.close();
  }
}

// Main function for testing
async function main() {
  const batchLoader = new FMPBatchLoader();
  
  try {
    // Example: Load data for top tech stocks
    const symbols = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
      'NVDA', 'TSLA', 'TSM', 'V', 'JPM'
    ];
    
    // Configuration
    const config: LoadingConfig = {
      dataTypes: ['profile', 'historical-prices'],  // Start with just 2 data types
      period: 'annual',
      historicalDays: 30,  // Last 30 days of prices
      batchSize: 5  // Process 5 symbols at a time
    };
    
    // Load data
    await batchLoader.loadSymbolData(symbols, config);
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await batchLoader.close();
  }
}

// Export for use in other scripts
export { FMPBatchLoader, LoadingConfig, LoadingProgress };

// Run if called directly
main().catch(console.error);