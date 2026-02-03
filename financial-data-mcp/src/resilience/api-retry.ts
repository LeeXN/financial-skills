/**
 * Retry mechanism with exponential backoff and jitter
 * Retries transient errors with increasing delays between attempts
 */

import type { ResilienceConfig } from '../types.js';

export class RetryError extends Error {
  constructor(
    public attempt: number,
    public maxAttempts: number,
    public delayMs: number,
    message?: string
  ) {
    super(message || `Retry attempt ${attempt}/${maxAttempts} after ${delayMs}ms`);
    this.name = 'RetryError';
  }
}

/**
 * Calculates delay for a retry attempt using exponential backoff with jitter
 * @param attemptNumber - Current retry attempt (0-indexed)
 * @param initialDelayMs - Base delay for first retry
 * @param maxDelayMs - Maximum allowed delay
 * @returns Delay in milliseconds with jitter applied
 */
export function calculateBackoffDelay(
  attemptNumber: number,
  initialDelayMs: number,
  maxDelayMs: number
): number {
  // Exponential backoff: delay = initial_delay * 2^attempt
  const baseDelay = initialDelayMs * Math.pow(2, attemptNumber);

  // Apply jitter: ±25% to avoid thundering herd problem
  const jitterPercent = 0.25;
  const jitterRange = baseDelay * jitterPercent;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;

  // Apply jitter and cap at max delay
  const delay = Math.min(baseDelay + jitter, maxDelayMs);
  return Math.max(0, Math.floor(delay));
}

/**
 * Classifies whether an error should trigger retry
 * @param error - Error to classify
 * @returns True if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    const statusCode = extractStatusCode(error);

    // Retry network errors (timeout, connection refused)
    if (errorMessage.includes('timeout') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('connection refused') ||
        errorMessage.includes('network error')) {
      return true;
    }

    // Retry HTTP 5xx server errors
    if (statusCode !== undefined && statusCode >= 500 && statusCode < 600) {
      return true;
    }

    // Retry HTTP 429 (rate limit)
    if (statusCode === 429) {
      return true;
    }

    // Do NOT retry client errors (4xx except 429)
    if (statusCode !== undefined && statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      return false;
    }

    // Retry JSON parse errors (partial responses)
    if (errorMessage.includes('json') && errorMessage.includes('parse')) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts HTTP status code from error if available
 * @param error - Error to extract status from
 * @returns Status code or undefined
 */
function extractStatusCode(error: Error): number | undefined {
  const match = error.message.match(/\b(\d{3})\b/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Wraps a function with retry logic
 * @param fn - Function to retry
 * @param config - Resilience configuration
 * @param context - Context for error messages (e.g., API name, endpoint)
 * @returns Result from function or throws if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: ResilienceConfig,
  context?: { apiName?: string; endpoint?: string; method?: string }
): Promise<T> {
  if (!config.retryEnabled) {
    return fn();
  }

  const maxAttempts = config.retryMaxAttempts;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      const isRetryable = isRetryableError(error);

      if (!isRetryable) {
        throw error;
      }

      if (attempt === maxAttempts - 1) {
        const maxRetriesError = new RetryError(attempt + 1, maxAttempts, 0);
        maxRetriesError.cause = error;
        throw maxRetriesError;
      }

      const delayMs = calculateBackoffDelay(
        attempt,
        config.retryInitialDelayMs,
        config.retryMaxDelayMs
      );

      const retryError = new RetryError(attempt + 1, maxAttempts, delayMs);
      retryError.cause = error;

      // Check for idempotency warning (POST requests)
      if (context?.method?.toLowerCase() === 'post') {
        console.warn(`[RETRY WARNING] Retrying non-idempotent POST request. Duplicate mutations may occur.`);
      }

      console.log(`[RETRY ATTEMPT] ${new Date().toISOString()} - API: ${context?.apiName || 'unknown'}, Attempt: ${attempt + 1}/${maxAttempts}, Delay: ${delayMs}ms, Reason: ${(error as Error).message}`);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Retry logic failed - should not reach here');
}
