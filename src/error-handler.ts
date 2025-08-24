import { DatabaseClient } from './database.js';
import { config } from 'dotenv';

config();

/**
 * Error types for categorization
 */
export enum ErrorType {
  API_RATE_LIMIT = 'API_RATE_LIMIT',
  API_AUTH = 'API_AUTH',
  API_NOT_FOUND = 'API_NOT_FOUND',
  API_SERVER_ERROR = 'API_SERVER_ERROR',
  DATABASE_CONNECTION = 'DATABASE_CONNECTION',
  DATABASE_QUERY = 'DATABASE_QUERY',
  DATA_VALIDATION = 'DATA_VALIDATION',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'LOW',        // Can be ignored, will retry
  MEDIUM = 'MEDIUM',  // Should be logged, will retry
  HIGH = 'HIGH',      // Needs attention, limited retries
  CRITICAL = 'CRITICAL' // Immediate attention, no retry
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

/**
 * Failed job interface
 */
interface FailedJob {
  jobType: string;
  payload: any;
  errorMessage: string;
  errorCount: number;
  lastErrorAt: Date;
  nextRetryAt: Date;
}

/**
 * Production Error Handler with retry logic and monitoring
 */
export class ErrorHandler {
  private db: DatabaseClient;
  private retryConfigs: Map<ErrorType, RetryConfig>;
  private circuitBreakers: Map<string, CircuitBreaker>;

  constructor(db?: DatabaseClient) {
    this.db = db || new DatabaseClient();
    this.retryConfigs = this.initializeRetryConfigs();
    this.circuitBreakers = new Map();
  }

  /**
   * Initialize retry configurations per error type
   */
  private initializeRetryConfigs(): Map<ErrorType, RetryConfig> {
    const configs = new Map<ErrorType, RetryConfig>();
    
    configs.set(ErrorType.API_RATE_LIMIT, {
      maxAttempts: 5,
      initialDelay: 60000,  // 1 minute
      maxDelay: 300000,     // 5 minutes
      backoffMultiplier: 2
    });
    
    configs.set(ErrorType.API_SERVER_ERROR, {
      maxAttempts: 3,
      initialDelay: 5000,   // 5 seconds
      maxDelay: 30000,      // 30 seconds
      backoffMultiplier: 2
    });
    
    configs.set(ErrorType.DATABASE_CONNECTION, {
      maxAttempts: 3,
      initialDelay: 2000,   // 2 seconds
      maxDelay: 10000,      // 10 seconds
      backoffMultiplier: 1.5
    });
    
    configs.set(ErrorType.NETWORK_TIMEOUT, {
      maxAttempts: 3,
      initialDelay: 3000,   // 3 seconds
      maxDelay: 15000,      // 15 seconds
      backoffMultiplier: 2
    });
    
    configs.set(ErrorType.DATA_VALIDATION, {
      maxAttempts: 1,      // No retry for validation errors
      initialDelay: 0,
      maxDelay: 0,
      backoffMultiplier: 1
    });
    
    return configs;
  }

  /**
   * Classify error type based on error details
   */
  classifyError(error: any): ErrorType {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || error.response?.status;
    
    // API errors
    if (code === 429 || message.includes('rate limit')) {
      return ErrorType.API_RATE_LIMIT;
    }
    if (code === 401 || code === 403) {
      return ErrorType.API_AUTH;
    }
    if (code === 404) {
      return ErrorType.API_NOT_FOUND;
    }
    if (code >= 500 && code < 600) {
      return ErrorType.API_SERVER_ERROR;
    }
    
    // Database errors
    if (message.includes('database') || message.includes('connection')) {
      return ErrorType.DATABASE_CONNECTION;
    }
    if (message.includes('query') || message.includes('sql')) {
      return ErrorType.DATABASE_QUERY;
    }
    
    // Network errors
    if (message.includes('timeout') || message.includes('econnrefused')) {
      return ErrorType.NETWORK_TIMEOUT;
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.DATA_VALIDATION;
    }
    
    return ErrorType.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  getErrorSeverity(errorType: ErrorType, errorCount: number): ErrorSeverity {
    if (errorType === ErrorType.API_AUTH || errorType === ErrorType.DATABASE_CONNECTION) {
      return ErrorSeverity.CRITICAL;
    }
    
    if (errorType === ErrorType.DATA_VALIDATION) {
      return ErrorSeverity.HIGH;
    }
    
    if (errorCount > 3) {
      return ErrorSeverity.HIGH;
    }
    
    if (errorType === ErrorType.API_RATE_LIMIT) {
      return ErrorSeverity.LOW;
    }
    
    return ErrorSeverity.MEDIUM;
  }

  /**
   * Handle error with retry logic
   */
  async handleError(
    error: any,
    context: {
      operation: string;
      payload?: any;
      attemptNumber?: number;
    }
  ): Promise<boolean> {
    const errorType = this.classifyError(error);
    const attemptNumber = context.attemptNumber || 1;
    const severity = this.getErrorSeverity(errorType, attemptNumber);
    
    // Log error
    await this.logError(error, errorType, severity, context);
    
    // Check circuit breaker
    const breaker = this.getCircuitBreaker(context.operation);
    if (breaker.isOpen()) {
      console.error(`Circuit breaker OPEN for ${context.operation}`);
      return false;
    }
    
    // Get retry config
    const retryConfig = this.retryConfigs.get(errorType);
    if (!retryConfig || attemptNumber >= retryConfig.maxAttempts) {
      // Max retries reached, add to failed jobs queue
      await this.addToFailedJobsQueue(context.operation, context.payload, error);
      breaker.recordFailure();
      return false;
    }
    
    // Calculate retry delay with exponential backoff
    const delay = Math.min(
      retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attemptNumber - 1),
      retryConfig.maxDelay
    );
    
    console.log(`Retrying ${context.operation} after ${delay}ms (attempt ${attemptNumber}/${retryConfig.maxAttempts})`);
    
    // Wait before retry
    await this.sleep(delay);
    
    return true; // Should retry
  }

  /**
   * Log error to database
   */
  private async logError(
    error: any,
    errorType: ErrorType,
    severity: ErrorSeverity,
    context: any
  ): Promise<void> {
    try {
      const errorDetails = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        type: errorType,
        severity: severity,
        context: context
      };
      
      // Log to console with color coding
      const severityColors = {
        [ErrorSeverity.LOW]: '\x1b[33m',      // Yellow
        [ErrorSeverity.MEDIUM]: '\x1b[35m',   // Magenta
        [ErrorSeverity.HIGH]: '\x1b[31m',     // Red
        [ErrorSeverity.CRITICAL]: '\x1b[41m'  // Red background
      };
      
      const color = severityColors[severity];
      const reset = '\x1b[0m';
      
      console.error(`${color}[${severity}] ${errorType}: ${error.message}${reset}`);
      
      // Log to database if connected
      if (this.db.pool) {
        await this.db.query(`
          INSERT INTO fmp.system_health (
            check_type, status, details, error_message
          ) VALUES ($1, $2, $3, $4)
        `, [
          'ERROR_LOG',
          severity,
          errorDetails,
          error.message
        ]);
      }
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  /**
   * Add failed job to retry queue
   */
  private async addToFailedJobsQueue(
    jobType: string,
    payload: any,
    error: any
  ): Promise<void> {
    try {
      const nextRetryAt = new Date();
      nextRetryAt.setHours(nextRetryAt.getHours() + 1); // Retry in 1 hour
      
      await this.db.query(`
        INSERT INTO fmp.failed_jobs (
          job_type, payload, error_message,
          error_count, last_error_at, next_retry_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (job_type, payload) DO UPDATE SET
          error_count = failed_jobs.error_count + 1,
          last_error_at = CURRENT_TIMESTAMP,
          next_retry_at = $6,
          error_message = $3
      `, [
        jobType,
        JSON.stringify(payload),
        error.message,
        1,
        new Date(),
        nextRetryAt
      ]);
      
      console.log(`Added ${jobType} to failed jobs queue for retry`);
    } catch (queueError) {
      console.error('Failed to add to retry queue:', queueError);
    }
  }

  /**
   * Process failed jobs queue
   */
  async processFailedJobs(): Promise<void> {
    try {
      const jobs = await this.db.query(`
        SELECT * FROM fmp.failed_jobs
        WHERE next_retry_at <= CURRENT_TIMESTAMP
        ORDER BY error_count ASC, next_retry_at ASC
        LIMIT 10
      `);
      
      console.log(`Processing ${jobs.rows.length} failed jobs...`);
      
      for (const job of jobs.rows) {
        console.log(`Retrying ${job.job_type} (attempt ${job.error_count + 1})`);
        // Job processing would be implemented here based on job_type
        // This would call the appropriate loader with the stored payload
      }
    } catch (error) {
      console.error('Error processing failed jobs:', error);
    }
  }

  /**
   * Get or create circuit breaker for an operation
   */
  private getCircuitBreaker(operation: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operation)) {
      this.circuitBreakers.set(operation, new CircuitBreaker(operation));
    }
    return this.circuitBreakers.get(operation)!;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wrap async function with error handling
   */
  async withRetry<T>(
    operation: string,
    fn: () => Promise<T>,
    payload?: any
  ): Promise<T | null> {
    let attemptNumber = 0;
    let lastError: any;
    
    while (attemptNumber < 5) { // Max 5 attempts
      attemptNumber++;
      
      try {
        const result = await fn();
        
        // Record success in circuit breaker
        const breaker = this.getCircuitBreaker(operation);
        breaker.recordSuccess();
        
        return result;
      } catch (error) {
        lastError = error;
        
        const shouldRetry = await this.handleError(error, {
          operation,
          payload,
          attemptNumber
        });
        
        if (!shouldRetry) {
          break;
        }
      }
    }
    
    console.error(`Failed after ${attemptNumber} attempts: ${lastError.message}`);
    return null;
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private name: string,
    private threshold: number = 5,
    private timeout: number = 60000 // 1 minute
  ) {}
  
  isOpen(): boolean {
    if (this.state === 'OPEN') {
      // Check if timeout has passed
      if (this.lastFailureTime && 
          Date.now() - this.lastFailureTime.getTime() > this.timeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }
  
  recordSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`Circuit breaker ${this.name} CLOSED`);
    }
  }
  
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      console.error(`Circuit breaker ${this.name} OPEN after ${this.failureCount} failures`);
    }
  }
}

/**
 * Global error handler singleton
 */
let globalErrorHandler: ErrorHandler | null = null;

export function getErrorHandler(): ErrorHandler {
  if (!globalErrorHandler) {
    globalErrorHandler = new ErrorHandler();
  }
  return globalErrorHandler;
}

export default ErrorHandler;