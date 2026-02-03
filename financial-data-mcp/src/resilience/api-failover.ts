/**
 * Automatic failover between data sources (Finnhub, Alpha Vantage, TwelveData, Tiingo)
 * Switches to secondary API when primary fails or is rate-limited
 */

import type { ResilienceConfig, ToolCompatibility, FailoverEvent, ApiSource } from '../types.js';
import { logger } from '../logger.js';

const TOOL_COMPATIBILITY: ToolCompatibility[] = [
  { tool: 'get_stock_quote', supportedApis: ['finnhub', 'alphavantage', 'twelvedata', 'tiingo'] },
  { tool: 'get_stock_candles', supportedApis: ['finnhub', 'twelvedata', 'tiingo'] },
  { tool: 'get_stock_price_history', supportedApis: ['finnhub', 'alphavantage', 'twelvedata', 'tiingo'] },
  { tool: 'get_financials', supportedApis: ['finnhub', 'alphavantage'] },
  { tool: 'get_company_info', supportedApis: ['finnhub', 'alphavantage', 'tiingo'] },
  { tool: 'get_company_overview', supportedApis: ['alphavantage', 'tiingo'] },
  { tool: 'get_news', supportedApis: ['finnhub', 'tiingo'] },
  { tool: 'get_technical_indicator', supportedApis: ['alphavantage', 'twelvedata'] },
  { tool: 'get_daily_prices', supportedApis: ['alphavantage', 'twelvedata', 'tiingo'] },
  { tool: 'get_quote', supportedApis: ['alphavantage', 'twelvedata', 'tiingo'] },
  { tool: 'get_income_statement', supportedApis: ['alphavantage'] },
  { tool: 'get_balance_sheet', supportedApis: ['alphavantage'] },
  { tool: 'get_cash_flow', supportedApis: ['alphavantage'] },
  { tool: 'get_company_basic_financials', supportedApis: ['finnhub'] },
  { tool: 'get_company_metrics', supportedApis: ['finnhub'] },
];

export class FailoverManager {
  private currentApi: ApiSource;
  private primaryApi: ApiSource;
  private secondaryApi: ApiSource;
  private readonly config: ResilienceConfig;

  constructor(config: ResilienceConfig) {
    this.config = config;
    this.primaryApi = config.primaryApiSource;
    this.secondaryApi = config.secondaryApiSource;
    this.currentApi = this.primaryApi;
  }

  async executeWithFailover<T>(
    toolName: string,
    primaryFn: () => Promise<T>,
    secondaryFn: () => Promise<T>
  ): Promise<T> {
    if (!this.config.apiFailoverEnabled) {
      return primaryFn();
    }

    const primaryApi = this.primaryApi;
    const secondaryApi = this.secondaryApi;

    const primarySupported = this.isToolSupported(toolName, primaryApi);
    const secondarySupported = this.isToolSupported(toolName, secondaryApi);

    logger.debug(`Executing with failover`, {
      toolName,
      primaryApi,
      secondaryApi,
      primarySupported,
      secondarySupported,
    });

    try {
      const result = await primaryFn();
      return result;
    } catch (error) {
      if (!primarySupported || !secondarySupported) {
        throw error;
      }

      logger.debug(`Primary API failed, initiating failover`, {
        toolName,
        primaryApi,
        secondaryApi,
        error: (error as Error).message,
      });

      this.logEvent('FAILOVER_INITIATED', `Primary API ${primaryApi} failed`, toolName);

      try {
        const result = await secondaryFn();
        this.logEvent('FAILOVER_REVERTED', `Primary API ${primaryApi} recovered`, toolName);
        return result;
      } catch (secondaryError) {
        const combinedError = new Error(
          `Both APIs failed. Primary: ${(error as Error).message}, Secondary: ${(secondaryError as Error).message}`
        );
        combinedError.cause = error;
        throw combinedError;
      }
    }
  }

  canFailover(toolName: string): boolean {
    if (!this.config.apiFailoverEnabled) {
      return false;
    }

    const primaryApi = this.primaryApi;
    const secondaryApi = this.secondaryApi;

    const primarySupported = this.isToolSupported(toolName, primaryApi);
    const secondarySupported = this.isToolSupported(toolName, secondaryApi);

    return primarySupported && secondarySupported;
  }

  getCurrentApi(): ApiSource {
    return this.currentApi;
  }

  private isToolSupported(toolName: string, api: ApiSource): boolean {
    const compatibility = TOOL_COMPATIBILITY.find(c => c.tool === toolName);
    return compatibility ? compatibility.supportedApis.includes(api) : false;
  }

  private logEvent(event: FailoverEvent['event'], reason: string, tool: string): void {
    const logEntry: FailoverEvent = {
      event,
      api: this.currentApi,
      reason,
      tool,
      timestamp: new Date().toISOString()
    };
    logger.info(`Failover event: ${event}`, logEntry as unknown as Record<string, unknown>);
  }

  resetToPrimary(): void {
    this.currentApi = this.primaryApi;
  }

  getCurrentPrimary(): ApiSource {
    return this.primaryApi;
  }

  getCurrentSecondary(): ApiSource {
    return this.secondaryApi;
  }
}
