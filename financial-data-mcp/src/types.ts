export interface StockQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  percentChange: number;
  highPriceOfDay: number;
  lowPriceOfDay: number;
  openPriceOfDay: number;
  previousClosePrice: number;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjustedClose?: number;
}

export interface CompanyFinancials {
  symbol: string;
  period?: 'annual' | 'quarterly';
  incomeStatement?: {
    revenue?: number;
    netIncome?: number;
    grossProfit?: number;
  };
  balanceSheet?: {
    totalAssets?: number;
    totalLiabilities?: number;
    totalEquity?: number;
  };
  cashFlowStatement?: {
    operatingCashFlow?: number;
    investingCashFlow?: number;
    financingCashFlow?: number;
    freeCashFlow?: number;
  };
}

export interface CompanyInfo {
  symbol: string;
  companyName: string;
  industry?: string;
  sector?: string;
  marketCap?: number;
  sharesOutstanding?: number;
  description?: string;
}

export interface NewsItem {
  category?: string;
  datetime?: number;
  headline?: string;
  id?: number;
  image?: string;
  related?: string;
  source?: string;
  summary?: string;
  url?: string;
}

export interface TechnicalIndicator {
  indicator: string;
  symbol: string;
  data: Record<string, number>;
}

export type ApiSource = 'finnhub' | 'alphavantage' | 'twelvedata' | 'tiingo' | 'sina' | 'eastmoney';

export type LogLevelType = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevelType;
  message: string;
  data?: Record<string, unknown>;
}

export interface ResilienceConfig {
  apiFailoverEnabled: boolean;
  primaryApiSource: ApiSource;
  secondaryApiSource: ApiSource;
  tertiaryApiSource?: ApiSource;
  quaternaryApiSource?: ApiSource;
  retryEnabled: boolean;
  retryMaxAttempts: number;
  retryInitialDelayMs: number;
  retryMaxDelayMs: number;
  apiTimeoutMs: number;
  finnhubTimeoutMs?: number;
  alphavantageTimeoutMs?: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerFailureThreshold: number;
  circuitBreakerTimeoutMs: number;
  circuitBreakerHalfOpenAttempts: number;
  keyRotationEnabled: boolean;
  keyRotationResetWindowMs: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  lastStateChange: number;
}

export interface ApiKeyInfo {
  key: string;
  index: number;
  usageCount: number;
  lastUsed: number;
  inCooldown: boolean;
  cooldownUntil?: number;
  lastRateLimitError?: number;
}

export interface FailoverEvent {
  event: 'FAILOVER_INITIATED' | 'FAILOVER_REVERTED';
  api: string;
  reason: string;
  tool: string;
  timestamp: string;
}

export interface RetryEvent {
  event: 'RETRY_ATTEMPT';
  api: string;
  attempt: number;
  delayMs: number;
  tool: string;
  timestamp: string;
}

export interface CircuitBreakerEvent {
  event: 'CIRCUIT_OPENED' | 'CIRCUIT_HALF_OPEN' | 'CIRCUIT_CLOSED';
  api: string;
  state: CircuitState;
  failureCount: number;
  tool?: string;
  timestamp: string;
}

export interface KeyRotationEvent {
  event: 'KEY_ROTATED' | 'KEY_RATE_LIMITED' | 'KEY_ROTATION_READY';
  api: string;
  keyIndex: number;
  reason?: string;
  timestamp: string;
}

export type ResilienceEvent = FailoverEvent | RetryEvent | CircuitBreakerEvent | KeyRotationEvent;

export interface ToolCompatibility {
  tool: string;
  supportedApis: ApiSource[];
}

export interface FailoverAttempt {
  source: ApiSource;
  keyIndex: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  error?: Error;
}

export interface CascadingFailoverResult<T> {
  data: T;
  source: ApiSource;
  attempts: FailoverAttempt[];
  totalDurationMs: number;
}

export type SourceExecutor<T> = (source: ApiSource) => Promise<T>;
