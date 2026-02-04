import type { ApiSource, FailoverAttempt, CascadingFailoverResult, SourceExecutor, ResilienceConfig } from '../types.js';
import { logger } from '../logger.js';
import { KeyManager } from './api-key-manager.js';
import { sourceRouter } from './source-router.js';
import { isRateLimitError, shouldFailoverToNextSource } from './error-detection.js';
import { SinaClient } from '../api/sina.js';
import { EastMoneyClient } from '../api/eastmoney.js';

export interface ApiClient {
  getStockQuote(symbol: string): Promise<any>;
  getStockCandles(symbol: string, resolution: string, from: number, to: number): Promise<any>;
  getCompanyBasicFinancials(symbol: string): Promise<any>;
  getCompanyMetrics(symbol: string, metricType?: string): Promise<any>;
  getNews(symbol: string, category?: string, minId?: number): Promise<any>;
  getDailyPrices(symbol: string, outputsize: 'compact' | 'full'): Promise<any>;
  getCompanyOverview(symbol: string): Promise<any>;
  getIncomeStatement(symbol: string): Promise<any>;
  getBalanceSheet(symbol: string): Promise<any>;
  getCashFlow(symbol: string): Promise<any>;
  getTechnicalIndicator(symbol: string, indicator: string, interval: string, time_period: string): Promise<any>;
  getQuote?(symbol: string): Promise<any>;
}

const DEFAULT_RESILIENCE_CONFIG: ResilienceConfig = {
  apiFailoverEnabled: true,
  primaryApiSource: 'finnhub',
  secondaryApiSource: 'alphavantage',
  retryEnabled: true,
  retryMaxAttempts: 3,
  retryInitialDelayMs: 1000,
  retryMaxDelayMs: 10000,
  apiTimeoutMs: 30000,
  circuitBreakerEnabled: true,
  circuitBreakerFailureThreshold: 5,
  circuitBreakerTimeoutMs: 60000,
  circuitBreakerHalfOpenAttempts: 3,
  keyRotationEnabled: true,
  keyRotationResetWindowMs: 3600000,
};

export class ResilientApiClient implements ApiClient {
  private circuitBreakers: Map<string, any> = new Map();
  private keyManagers: Map<ApiSource, KeyManager> = new Map();
  private failoverManager: any;
  private readonly config: ResilienceConfig;
  public readonly finnhubClient: any;
  public readonly alphavantageClient: any;
  public readonly twelvedataClient: any;
  public readonly tiingoClient: any;
  public readonly sinaClient: SinaClient;
  public readonly eastmoneyClient: EastMoneyClient;

  constructor(
    finnhubClient: any,
    alphavantageClient: any,
    twelvedataClient?: any,
    tiingoClient?: any,
    config?: Partial<ResilienceConfig>
  ) {
    this.finnhubClient = finnhubClient;
    this.alphavantageClient = alphavantageClient;
    this.twelvedataClient = twelvedataClient;
    this.tiingoClient = tiingoClient;
    this.sinaClient = new SinaClient();
    this.eastmoneyClient = new EastMoneyClient();
    this.config = { ...DEFAULT_RESILIENCE_CONFIG, ...config };
    this.initializeKeyManagers();
  }

  private initializeKeyManagers(): void {
    const sources: ApiSource[] = ['finnhub', 'alphavantage', 'twelvedata', 'tiingo'];
    for (const source of sources) {
      if (this.getClientForSource(source)) {
        this.keyManagers.set(source, new KeyManager(source, this.config));
        logger.debug(`Initialized KeyManager for ${source}`);
      }
    }
  }

  getKeyManager(source: ApiSource): KeyManager | undefined {
    return this.keyManagers.get(source);
  }

  isSourceAvailable(source: ApiSource): boolean {
    const client = this.getClientForSource(source);
    if (!client) return false;
    
    const keyManager = this.keyManagers.get(source);
    if (!keyManager) return true;
    
    return keyManager.hasAvailableKey();
  }

  private getClientForSource(source: ApiSource): any {
    switch (source) {
      case 'finnhub':
        return this.finnhubClient;
      case 'alphavantage':
        return this.alphavantageClient;
      case 'twelvedata':
        return this.twelvedataClient;
      case 'tiingo':
        return this.tiingoClient;
      case 'sina':
        return this.sinaClient;
      case 'eastmoney':
        return this.eastmoneyClient;
      default:
        return this.finnhubClient;
    }
  }

  async getStockQuote(symbol: string): Promise<any> {
    const executors = this.createExecutor({ symbol });
    const result = await this.executeWithCascadingFailover('get_stock_quote', executors.get_stock_quote, symbol);
    return result.data;
  }

  async getStockCandles(symbol: string, resolution: string, from: number, to: number): Promise<any> {
    const executors = this.createExecutor({ symbol, resolution, from, to });
    const result = await this.executeWithCascadingFailover('get_stock_candles', executors.get_stock_candles, symbol);
    return result.data;
  }

  async getCompanyBasicFinancials(symbol: string): Promise<any> {
    return this.executeWithResilience('finnhub', () => this.finnhubClient.getCompanyBasicFinancials(symbol));
  }

  async getCompanyMetrics(symbol: string, metricType?: string): Promise<any> {
    return this.executeWithResilience('finnhub', () => this.finnhubClient.getCompanyMetrics(symbol, metricType));
  }

  async getNews(symbol: string, category?: string, minId?: number): Promise<any> {
    const executors = this.createExecutor({ symbol, category, minId });
    const result = await this.executeWithCascadingFailover('get_news', executors.get_news, symbol);
    return result.data;
  }

  async getDailyPrices(symbol: string, outputsize: 'compact' | 'full'): Promise<any> {
    const executors = this.createExecutor({ symbol, outputsize });
    const result = await this.executeWithCascadingFailover('get_daily_prices', executors.get_daily_prices, symbol);
    return result.data;
  }

  async getQuote(symbol: string): Promise<any> {
    const executors = this.createExecutor({ symbol });
    const result = await this.executeWithCascadingFailover('get_quote', executors.get_quote, symbol);
    return result.data;
  }

  async getCompanyOverview(symbol: string): Promise<any> {
    const executors = this.createExecutor({ symbol });
    const result = await this.executeWithCascadingFailover('get_company_overview', executors.get_company_overview, symbol);
    return result.data;
  }

  async getIncomeStatement(symbol: string): Promise<any> {
    return this.executeWithResilience('alphavantage', () => this.alphavantageClient.getIncomeStatement(symbol));
  }

  async getBalanceSheet(symbol: string): Promise<any> {
    return this.executeWithResilience('alphavantage', () => this.alphavantageClient.getBalanceSheet(symbol));
  }

  async getCashFlow(symbol: string): Promise<any> {
    return this.executeWithResilience('alphavantage', () => this.alphavantageClient.getCashFlow(symbol));
  }

  async getTechnicalIndicator(symbol: string, indicator: string, interval: string, time_period: string): Promise<any> {
    const executors = this.createExecutor({ symbol, indicator, interval, time_period });
    const result = await this.executeWithCascadingFailover('get_technical_indicator', executors.get_technical_indicator, symbol);
    return result.data;
  }

  async getTwelveDataQuote(symbol: string): Promise<any> {
    if (!this.twelvedataClient) {
      throw new Error('TwelveData client not configured');
    }
    return this.executeWithResilience('twelvedata', () => this.twelvedataClient.getStockQuote(symbol));
  }

  async getTwelveDataCandles(symbol: string, resolution: string, from: number, to: number): Promise<any> {
    if (!this.twelvedataClient) {
      throw new Error('TwelveData client not configured');
    }
    return this.executeWithResilience('twelvedata', () => 
      this.twelvedataClient.getStockCandles(symbol, resolution, from, to)
    );
  }

  async getTiingoQuote(symbol: string): Promise<any> {
    if (!this.tiingoClient) {
      throw new Error('Tiingo client not configured');
    }
    return this.executeWithResilience('tiingo', () => this.tiingoClient.getQuote(symbol));
  }

  async getTiingoDailyPrices(symbol: string, outputsize: 'compact' | 'full'): Promise<any> {
    if (!this.tiingoClient) {
      throw new Error('Tiingo client not configured');
    }
    return this.executeWithResilience('tiingo', () => this.tiingoClient.getDailyPrices(symbol, outputsize));
  }

  async getTiingoNews(symbol: string, category?: string, minId?: number): Promise<any> {
    if (!this.tiingoClient) {
      throw new Error('Tiingo client not configured');
    }
    return this.executeWithResilience('tiingo', () => this.tiingoClient.getNews(symbol, category, minId));
  }

  async executeWithKeyRotation<T>(source: ApiSource, fn: () => Promise<T>): Promise<T> {
    const keyManager = this.keyManagers.get(source);
    if (!keyManager) {
      return fn();
    }

    const maxKeyAttempts = keyManager.getTotalKeyCount();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxKeyAttempts; attempt++) {
      const keyInfo = keyManager.getNextKey(source);
      if (!keyInfo) {
        logger.debug(`No available keys for ${source}, exhausted all keys`);
        break;
      }

      try {
        const result = await fn();
        keyManager.recordUsage(keyInfo.index);
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (isRateLimitError(error)) {
          logger.debug(`Rate limit hit on key ${keyInfo.index}, rotating`, { source, keyIndex: keyInfo.index });
          keyManager.markRateLimit(keyInfo.index);
          const rotated = keyManager.rotateKey();
          if (!rotated) {
            logger.warn(`All keys exhausted for ${source}`);
            break;
          }
          continue;
        }
        
        throw error;
      }
    }

    throw lastError || new Error(`All keys exhausted for ${source}`);
  }

  async executeWithCascadingFailover<T>(
    toolName: string,
    executor: SourceExecutor<T>,
    symbol?: string
  ): Promise<CascadingFailoverResult<T>> {
    const sources = sourceRouter.getSourcesForTool(toolName, symbol);
    const attempts: FailoverAttempt[] = [];
    const overallStartTime = Date.now();
    
    logger.debug(`Starting cascading failover for ${toolName}`, { sources });

    for (const source of sources) {
      if (!this.isSourceAvailable(source)) {
        logger.debug(`Skipping unavailable source ${source} for ${toolName}`);
        continue;
      }

      const keyManager = this.keyManagers.get(source);
      const keyIndex = keyManager?.getCurrentKeyIndex(source) ?? 0;
      const attemptStart = Date.now();

      try {
        const data = await this.executeWithKeyRotation(source, () => executor(source));
        const attemptEnd = Date.now();

        attempts.push({
          source,
          keyIndex,
          startTime: attemptStart,
          endTime: attemptEnd,
          durationMs: attemptEnd - attemptStart,
          success: true,
        });

        logger.debug(`Cascading failover succeeded on ${source}`, { toolName, source, attemptCount: attempts.length });

        return {
          data,
          source,
          attempts,
          totalDurationMs: Date.now() - overallStartTime,
        };
      } catch (error) {
        const attemptEnd = Date.now();
        const err = error as Error;

        attempts.push({
          source,
          keyIndex,
          startTime: attemptStart,
          endTime: attemptEnd,
          durationMs: attemptEnd - attemptStart,
          success: false,
          error: err,
        });

        logger.debug(`Source ${source} failed for ${toolName}, trying next`, { 
          source, 
          error: err.message,
          shouldFailover: shouldFailoverToNextSource(error)
        });

        if (!shouldFailoverToNextSource(error)) {
          throw error;
        }
      }
    }

    const errors = attempts.filter(a => !a.success).map(a => a.error).filter(Boolean);
    const aggregateMessage = `All sources failed for ${toolName}: ${errors.map(e => e?.message).join(', ')}`;
    logger.error(aggregateMessage, { toolName, attemptCount: attempts.length });
    
    const aggregateError = new Error(aggregateMessage);
    (aggregateError as any).attempts = attempts;
    throw aggregateError;
  }

  createExecutor(params: Record<string, any>): Record<string, SourceExecutor<any>> {
    return {
      get_stock_quote: (source: ApiSource) => {
        const client = this.getClientForSource(source);
        if (!client?.getStockQuote) throw new Error(`${source} does not support get_stock_quote`);
        return client.getStockQuote(params.symbol);
      },
      get_stock_candles: (source: ApiSource) => {
        const client = this.getClientForSource(source);
        if (!client?.getStockCandles) throw new Error(`${source} does not support get_stock_candles`);
        return client.getStockCandles(params.symbol, params.resolution, params.from, params.to);
      },
      get_daily_prices: (source: ApiSource) => {
        const client = this.getClientForSource(source);
        if (!client?.getDailyPrices) throw new Error(`${source} does not support get_daily_prices`);
        return client.getDailyPrices(params.symbol, params.outputsize);
      },
      get_news: (source: ApiSource) => {
        const client = this.getClientForSource(source);
        if (!client?.getNews) throw new Error(`${source} does not support get_news`);
        return client.getNews(params.symbol, params.category, params.minId);
      },
      get_quote: (source: ApiSource) => {
        const client = this.getClientForSource(source);
        const quoteFn = client?.getQuote || client?.getStockQuote;
        if (!quoteFn) throw new Error(`${source} does not support get_quote`);
        return quoteFn.call(client, params.symbol);
      },
      get_company_overview: (source: ApiSource) => {
        const client = this.getClientForSource(source);
        if (!client?.getCompanyOverview) throw new Error(`${source} does not support get_company_overview`);
        return client.getCompanyOverview(params.symbol);
      },
      get_technical_indicator: (source: ApiSource) => {
        const client = this.getClientForSource(source);
        if (!client?.getTechnicalIndicator) throw new Error(`${source} does not support get_technical_indicator`);
        return client.getTechnicalIndicator(params.symbol, params.indicator, params.interval, params.time_period);
      },
    };
  }

  async executeWithResilience(source: ApiSource, fn: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    
    logger.debug(`API call starting`, { source });
    
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      const responseSize = JSON.stringify(result).length;
      
      logger.debug(`API call completed`, {
        source,
        durationMs: duration,
        responseBytes: responseSize,
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.debug(`API call failed`, {
        source,
        durationMs: duration,
        error: (error as Error).message,
      });
      
      throw error;
    }
  }
}
