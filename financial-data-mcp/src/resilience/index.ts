/**
 * Resilience layer composition
 * Exports and composes all resilience modules for unified API access
 */

import type { ResilienceConfig } from '../types.js';

export { withTimeout, getApiTimeout, isTimeoutError, TimeoutError } from './api-timeout.js';
export { withRetry, isRetryableError, RetryError } from './api-retry.js';
export { CircuitBreaker } from './circuit-breaker.js';
export { FailoverManager } from './api-failover.js';
export { KeyManager } from './api-key-manager.js';

export type { ResilienceConfig };

/**
 * Loads resilience configuration from environment variables
 * @returns Configuration with all settings
 */
export function loadResilienceConfig(): ResilienceConfig {
  return {
    apiFailoverEnabled: process.env.API_FAILOVER_ENABLED === 'true',
    primaryApiSource: (process.env.PRIMARY_API_SOURCE as 'finnhub' | 'alphavantage') || 'finnhub',
    secondaryApiSource: (process.env.SECONDARY_API_SOURCE as 'finnhub' | 'alphavantage') || 'alphavantage',
    retryEnabled: process.env.RETRY_ENABLED === 'true',
    retryMaxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3', 10),
    retryInitialDelayMs: parseInt(process.env.RETRY_INITIAL_DELAY_MS || '1000', 10),
    retryMaxDelayMs: parseInt(process.env.RETRY_MAX_DELAY_MS || '10000', 10),
    apiTimeoutMs: parseInt(process.env.API_TIMEOUT_MS || '30000', 10),
    finnhubTimeoutMs: process.env.FINNHUB_TIMEOUT_MS ? parseInt(process.env.FINNHUB_TIMEOUT_MS, 10) : undefined,
    alphavantageTimeoutMs: process.env.ALPHAVANTAGE_TIMEOUT_MS ? parseInt(process.env.ALPHAVANTAGE_TIMEOUT_MS, 10) : undefined,
    circuitBreakerEnabled: process.env.CIRCUIT_BREAKER_ENABLED === 'true',
    circuitBreakerFailureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
    circuitBreakerTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '30000', 10),
    circuitBreakerHalfOpenAttempts: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_ATTEMPTS || '1', 10),
    keyRotationEnabled: process.env.KEY_ROTATION_ENABLED === 'true',
    keyRotationResetWindowMs: parseInt(process.env.KEY_ROTATION_RESET_WINDOW_MS || '3600000', 10)
  };
}
