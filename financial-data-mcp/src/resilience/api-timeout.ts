/**
 * Timeout enforcement for API requests
 * Prevents indefinite hangs by aborting requests after configurable duration
 */

import type { ResilienceConfig } from '../types.js';

export class TimeoutError extends Error {
  constructor(
    public apiName: string,
    public endpoint: string,
    public timeoutMs: number,
    message?: string
  ) {
    super(message || `Request to ${apiName} at ${endpoint} timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Wraps a promise with timeout control
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout duration in milliseconds
 * @param apiName - API name for error messages (optional)
 * @param endpoint - Endpoint being called (optional)
 * @returns Promise that rejects with TimeoutError if timeout exceeded
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  apiName?: string,
  endpoint?: string
): Promise<T> {
  // Check if timeout is disabled (0 or negative)
  if (timeoutMs <= 0) {
    return promise;
  }

  // Create a promise that rejects after timeout
  const timeoutPromise = new Promise<T>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(apiName || 'API', endpoint || 'unknown', timeoutMs));
    }, timeoutMs);

    // If the promise completes, cancel the timeout
    promise.finally(() => {
      clearTimeout(timeoutId);
    });
  });

  // Race between the actual promise and timeout
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Get timeout duration for a specific API
 * @param config - Resilience configuration
 * @param apiName - API name ('finnhub' or 'alphavantage')
 * @returns Timeout duration in milliseconds
 */
export function getApiTimeout(config: ResilienceConfig, apiName: 'finnhub' | 'alphavantage'): number {
  // Check for API-specific timeout first
  if (apiName === 'finnhub' && config.finnhubTimeoutMs !== undefined) {
    return config.finnhubTimeoutMs;
  }
  if (apiName === 'alphavantage' && config.alphavantageTimeoutMs !== undefined) {
    return config.alphavantageTimeoutMs;
  }

  // Fall back to global timeout
  return config.apiTimeoutMs;
}

/**
 * Classifies error as timeout-related for retry logic
 * @param error - Error to classify
 * @returns True if error is a timeout
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    return errorMessage.includes('timeout') || errorMessage.includes('timed out');
  }
  return false;
}
