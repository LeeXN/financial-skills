/**
 * Circuit breaker pattern implementation
 * Prevents cascading failures by blocking calls to failing APIs
 */

import type { ResilienceConfig } from '../types.js';

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private lastStateChange = 0;
  private readonly config: ResilienceConfig;
  private readonly apiName: string;

  constructor(apiName: string, config: ResilienceConfig) {
    this.apiName = apiName;
    this.config = config;
    this.logEvent('CIRCUIT_CLOSED', 'Circuit initialized in CLOSED state');
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.circuitBreakerEnabled) {
      return fn();
    }

    if (this.circuitState === 'open') {
      const now = Date.now();
      const timeUntilHalfOpen = this.config.circuitBreakerTimeoutMs - (now - this.lastFailureTime);
      const error = new Error(
        `Circuit breaker is OPEN for ${this.apiName}. ` +
        `Retry after ${Math.ceil(timeUntilHalfOpen / 1000)}s`
      );
      (error as any).code = 'CIRCUIT_OPEN';
      throw error;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.circuitState !== 'closed') {
      this.circuitState = 'closed';
      this.lastStateChange = Date.now();
      this.logEvent('CIRCUIT_CLOSED', 'API recovered, circuit closed');
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    const threshold = this.config.circuitBreakerFailureThreshold;

    if (this.failureCount >= threshold && this.circuitState !== 'open') {
      this.circuitState = 'open';
      this.lastStateChange = Date.now();
      this.logEvent('CIRCUIT_OPENED', `Circuit opened after ${this.failureCount} failures`);
    }
  }

  async testRecovery<T>(fn: () => Promise<T>): Promise<T> {
    if (this.circuitState !== 'open') {
      return fn();
    }

    const now = Date.now();
    const timeSinceOpen = now - this.lastFailureTime;

    if (timeSinceOpen >= this.config.circuitBreakerTimeoutMs) {
      this.circuitState = 'half-open';
      this.lastStateChange = Date.now();
      this.logEvent('CIRCUIT_HALF_OPEN', 'Testing recovery with single request');

      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        throw error;
      }
    } else {
      const error = new Error(
        `Circuit breaker is still OPEN for ${this.apiName}. ` +
        `Wait ${Math.ceil((this.config.circuitBreakerTimeoutMs - timeSinceOpen) / 1000)}s before recovery test`
      );
      (error as any).code = 'CIRCUIT_OPEN';
      throw error;
    }
  }

  getState() {
    return {
      state: this.circuitState,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange
    };
  }

  getHalfOpenAttemptsRemaining(): number {
    if (this.circuitState !== 'half-open') {
      return 0;
    }
    const now = Date.now();
    const timeSinceHalfOpen = now - this.lastStateChange;
    const timeUntilReopen = this.config.circuitBreakerTimeoutMs - timeSinceHalfOpen;
    return timeUntilReopen > 0 ? this.config.circuitBreakerHalfOpenAttempts : 0;
  }

  forceOpen(): void {
    this.circuitState = 'open';
    this.lastStateChange = Date.now();
    this.lastFailureTime = Date.now();
    this.logEvent('CIRCUIT_OPENED', 'Circuit forced open (manual override)');
  }

  forceClose(): void {
    this.circuitState = 'closed';
    this.failureCount = 0;
    this.lastStateChange = Date.now();
    this.logEvent('CIRCUIT_CLOSED', 'Circuit forced closed (manual override)');
  }

  reset(): void {
    this.circuitState = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.lastStateChange = Date.now();
    this.logEvent('CIRCUIT_CLOSED', 'Circuit reset on startup');
  }

  private logEvent(event: 'CIRCUIT_OPENED' | 'CIRCUIT_HALF_OPEN' | 'CIRCUIT_CLOSED', reason: string): void {
    const logEntry = {
      event,
      api: this.apiName,
      state: this.circuitState,
      failureCount: this.failureCount,
      reason,
      timestamp: new Date().toISOString()
    };
    console.error(JSON.stringify(logEntry));
  }
}
