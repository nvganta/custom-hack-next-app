import { logger } from './logger';

export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  name: string;
}

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = options;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        await logger.info(
          `Circuit breaker ${this.options.name} transitioning to HALF_OPEN`,
          'circuit_breaker'
        );
      } else {
        throw new Error(`Circuit breaker ${this.options.name} is OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = 'CLOSED';
        logger.info(
          `Circuit breaker ${this.options.name} transitioning to CLOSED`,
          'circuit_breaker'
        );
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(
        `Circuit breaker ${this.options.name} transitioning to OPEN`,
        'circuit_breaker',
        {
          failure_count: this.failureCount,
          threshold: this.options.failureThreshold
        }
      );
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

export class ResilientHttpClient {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private defaultRetryOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    retryCondition: (error) => {
      // Retry on network errors and 5xx status codes
      return (
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED' ||
        (error.response && error.response.status >= 500)
      );
    }
  };

  private defaultCircuitBreakerOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 10000, // 10 seconds
    name: 'default'
  };

  private getCircuitBreaker(name: string): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      this.circuitBreakers.set(
        name,
        new CircuitBreaker({ ...this.defaultCircuitBreakerOptions, name })
      );
    }
    return this.circuitBreakers.get(name)!;
  }

  async fetchWithResilience(
    url: string,
    options: RequestInit = {},
    retryOptions: Partial<RetryOptions> = {},
    circuitBreakerName: string = 'default'
  ): Promise<Response> {
    const finalRetryOptions = { ...this.defaultRetryOptions, ...retryOptions };
    const circuitBreaker = this.getCircuitBreaker(circuitBreakerName);

    return await this.executeWithRetry(
      () => circuitBreaker.execute(() => fetch(url, options)),
      finalRetryOptions,
      `HTTP ${options.method || 'GET'} ${url}`
    );
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {},
    operationName: string = 'operation'
  ): Promise<T> {
    const finalOptions = { ...this.defaultRetryOptions, ...options };
    let lastError: any;

    for (let attempt = 1; attempt <= finalOptions.maxAttempts; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;

        await logger.logPerformance(operationName, duration, {
          attempt,
          success: true
        });

        return result;
      } catch (error) {
        lastError = error;
        const shouldRetry = finalOptions.retryCondition?.(error) ?? true;

        await logger.warn(
          `${operationName} failed on attempt ${attempt}`,
          'retry_logic',
          {
            attempt,
            max_attempts: finalOptions.maxAttempts,
            error_message: error instanceof Error ? error.message : String(error),
            will_retry: shouldRetry && attempt < finalOptions.maxAttempts
          },
          error instanceof Error ? error : undefined
        );

        if (!shouldRetry || attempt === finalOptions.maxAttempts) {
          break;
        }

        // Call retry callback if provided
        finalOptions.onRetry?.(attempt, error);

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalOptions.baseDelay * Math.pow(finalOptions.backoffFactor, attempt - 1),
          finalOptions.maxDelay
        );

        await logger.debug(
          `Retrying ${operationName} in ${delay}ms`,
          'retry_logic',
          { attempt, delay, next_attempt: attempt + 1 }
        );

        await this.sleep(delay);
      }
    }

    await logger.error(
      `${operationName} failed after ${finalOptions.maxAttempts} attempts`,
      'retry_exhausted',
      {
        max_attempts: finalOptions.maxAttempts,
        final_error: lastError instanceof Error ? lastError.message : String(lastError)
      },
      lastError instanceof Error ? lastError : undefined
    );

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get circuit breaker stats for monitoring
  getCircuitBreakerStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    for (const [name, breaker] of this.circuitBreakers.entries()) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  // Reset all circuit breakers (useful for testing or manual recovery)
  resetCircuitBreakers(): void {
    this.circuitBreakers.clear();
    logger.info('All circuit breakers have been reset', 'circuit_breaker_reset');
  }
}

// Enhanced fetch wrapper with automatic resilience
export class ResilientApiClient {
  private httpClient: ResilientHttpClient;
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = '', defaultHeaders: Record<string, string> = {}) {
    this.httpClient = new ResilientHttpClient();
    this.baseUrl = baseUrl;
    this.defaultHeaders = defaultHeaders;
  }

  async get(
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: Partial<RetryOptions>
  ): Promise<Response> {
    return this.request('GET', endpoint, options, retryOptions);
  }

  async post(
    endpoint: string,
    data?: any,
    options: RequestInit = {},
    retryOptions?: Partial<RetryOptions>
  ): Promise<Response> {
    const postOptions = {
      ...options,
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    return this.request('POST', endpoint, postOptions, retryOptions);
  }

  async put(
    endpoint: string,
    data?: any,
    options: RequestInit = {},
    retryOptions?: Partial<RetryOptions>
  ): Promise<Response> {
    const putOptions = {
      ...options,
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    return this.request('PUT', endpoint, putOptions, retryOptions);
  }

  async delete(
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: Partial<RetryOptions>
  ): Promise<Response> {
    return this.request('DELETE', endpoint, options, retryOptions);
  }

  private async request(
    method: string,
    endpoint: string,
    options: RequestInit = {},
    retryOptions?: Partial<RetryOptions>
  ): Promise<Response> {
    const url = this.baseUrl + endpoint;
    const finalOptions = {
      method,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      },
      ...options
    };

    const circuitBreakerName = this.getCircuitBreakerName(url);
    
    return await this.httpClient.fetchWithResilience(
      url,
      finalOptions,
      retryOptions,
      circuitBreakerName
    );
  }

  private getCircuitBreakerName(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown_host';
    }
  }

  // Get monitoring stats
  getStats() {
    return this.httpClient.getCircuitBreakerStats();
  }

  // Reset circuit breakers
  reset() {
    this.httpClient.resetCircuitBreakers();
  }
}

// Specialized clients for different services
export class FirecrawlClient extends ResilientApiClient {
  constructor(apiKey?: string) {
    super('https://api.firecrawl.dev', {
      'Authorization': `Bearer ${apiKey || process.env.FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json'
    });
  }

  async crawlUrl(url: string, options: any = {}) {
    const retryOptions: Partial<RetryOptions> = {
      maxAttempts: 2, // Firecrawl can be slow, limit retries
      baseDelay: 2000,
      retryCondition: (error) => {
        // Don't retry on 4xx errors (likely API key or quota issues)
        return !(error.response && error.response.status >= 400 && error.response.status < 500);
      }
    };

    const response = await this.post('/v1/crawl', {
      url,
      ...options
    }, {}, retryOptions);

    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

export class OpenAIClient extends ResilientApiClient {
  constructor(apiKey?: string) {
    super('https://api.openai.com', {
      'Authorization': `Bearer ${apiKey || process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    });
  }

  async createCompletion(prompt: string, options: any = {}) {
    const retryOptions: Partial<RetryOptions> = {
      maxAttempts: 3,
      baseDelay: 1000,
      retryCondition: (error) => {
        // Retry on rate limits and server errors
        return error.response && (
          error.response.status === 429 || // Rate limit
          error.response.status >= 500     // Server errors
        );
      }
    };

    const response = await this.post('/v1/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      ...options
    }, {}, retryOptions);

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }
}

// Export singleton instances
export const resilientHttp = new ResilientHttpClient();
export const firecrawlClient = new FirecrawlClient();
export const openaiClient = new OpenAIClient();

// Utility function to wrap any async operation with retry logic
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  operationName: string = 'operation'
): Promise<T> {
  return await resilientHttp.executeWithRetry(operation, options, operationName);
} 