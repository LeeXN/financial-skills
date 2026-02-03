import type { ApiSource } from '../types.js';
import { logger } from '../logger.js';

const OPTIMAL_SOURCE_MAP: Record<string, ApiSource[]> = {
  'get_stock_quote': ['finnhub', 'twelvedata', 'tiingo', 'alphavantage'],
  'get_stock_candles': ['twelvedata', 'finnhub', 'tiingo'],
  'get_stock_price_history': ['twelvedata', 'finnhub', 'tiingo', 'alphavantage'],
  'get_technical_indicator': ['twelvedata', 'alphavantage'],
  'get_daily_prices': ['tiingo', 'alphavantage', 'twelvedata'],
  'get_news': ['tiingo', 'finnhub'],
  'get_quote': ['twelvedata', 'tiingo', 'alphavantage'],
  'get_company_overview': ['tiingo', 'alphavantage'],
  'get_company_info': ['finnhub', 'alphavantage', 'tiingo'],
  'get_financials': ['finnhub', 'alphavantage'],
  'get_company_basic_financials': ['finnhub'],
  'get_company_metrics': ['finnhub'],
  'get_income_statement': ['alphavantage'],
  'get_balance_sheet': ['alphavantage'],
  'get_cash_flow': ['alphavantage'],
};

function parseSourcePriorityEnv(toolName: string): ApiSource[] | null {
  const envKey = `SOURCE_PRIORITY_${toolName.toUpperCase()}`;
  const envValue = process.env[envKey];
  
  if (!envValue) return null;
  
  const sources = envValue.split(',')
    .map(s => s.trim().toLowerCase() as ApiSource)
    .filter(s => ['finnhub', 'alphavantage', 'twelvedata', 'tiingo'].includes(s));
  
  if (sources.length === 0) {
    logger.warn(`Invalid SOURCE_PRIORITY for ${toolName}, using default`, { envKey, envValue });
    return null;
  }
  
  logger.debug(`Custom source priority loaded`, { toolName, sources });
  return sources;
}

export class SourceRouter {
  private customPriorities: Map<string, ApiSource[]> = new Map();
  
  constructor() {
    this.loadCustomPriorities();
  }
  
  private loadCustomPriorities(): void {
    for (const toolName of Object.keys(OPTIMAL_SOURCE_MAP)) {
      const custom = parseSourcePriorityEnv(toolName);
      if (custom) {
        this.customPriorities.set(toolName, custom);
      }
    }
  }
  
  getSourcesForTool(toolName: string): ApiSource[] {
    const custom = this.customPriorities.get(toolName);
    if (custom) {
      return custom;
    }
    
    const defaultSources = OPTIMAL_SOURCE_MAP[toolName];
    if (defaultSources) {
      return defaultSources;
    }
    
    logger.warn(`No source mapping for tool, defaulting to finnhub`, { toolName });
    return ['finnhub'];
  }
  
  getDefaultSources(toolName: string): ApiSource[] {
    return OPTIMAL_SOURCE_MAP[toolName] || ['finnhub'];
  }
  
  hasCustomPriority(toolName: string): boolean {
    return this.customPriorities.has(toolName);
  }
  
  getAllToolNames(): string[] {
    return Object.keys(OPTIMAL_SOURCE_MAP);
  }
}

export const sourceRouter = new SourceRouter();
