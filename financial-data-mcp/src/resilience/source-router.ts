import type { ApiSource } from '../types.js';
import { logger } from '../logger.js';
import { getMarketFromSymbol, type Market } from './market-router.js';

const VALID_SOURCES: ApiSource[] = ['finnhub', 'alphavantage', 'twelvedata', 'tiingo', 'sina', 'eastmoney'];

const OPTIMAL_SOURCE_MAP: Record<string, ApiSource[]> = {
  'get_stock_quote': ['finnhub', 'twelvedata', 'tiingo', 'alphavantage', 'sina', 'eastmoney'],
  'get_stock_candles': ['twelvedata', 'finnhub', 'tiingo', 'sina', 'eastmoney'],
  'get_stock_price_history': ['twelvedata', 'finnhub', 'tiingo', 'alphavantage', 'sina', 'eastmoney'],
  'get_technical_indicator': ['twelvedata', 'alphavantage'],
  'get_daily_prices': ['tiingo', 'alphavantage', 'twelvedata', 'sina', 'eastmoney'],
  'get_news': ['tiingo', 'finnhub'],
  'get_quote': ['twelvedata', 'tiingo', 'alphavantage', 'sina', 'eastmoney'],
  'get_company_overview': ['tiingo', 'alphavantage'],
  'get_company_info': ['finnhub', 'alphavantage', 'tiingo'],
  'get_financials': ['finnhub', 'alphavantage'],
  'get_company_basic_financials': ['finnhub'],
  'get_company_metrics': ['finnhub'],
  'get_income_statement': ['alphavantage'],
  'get_balance_sheet': ['alphavantage'],
  'get_cash_flow': ['alphavantage'],
};

const MARKET_SOURCE_FILTER: Record<Market, ApiSource[]> = {
  'US': ['finnhub', 'twelvedata', 'tiingo', 'alphavantage'],
  'SH': ['sina', 'eastmoney'],
  'SZ': ['sina', 'eastmoney'],
  'BJ': ['sina', 'eastmoney'],
  'HK': ['finnhub', 'twelvedata', 'sina'],
  'UNKNOWN': ['finnhub', 'alphavantage', 'sina', 'eastmoney'],
};

function parseSourcePriorityEnv(toolName: string): ApiSource[] | null {
  const envKey = `SOURCE_PRIORITY_${toolName.toUpperCase()}`;
  const envValue = process.env[envKey];
  
  if (!envValue) return null;
  
  const sources = envValue.split(',')
    .map(s => s.trim().toLowerCase() as ApiSource)
    .filter(s => VALID_SOURCES.includes(s));
  
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
  
  getSourcesForTool(toolName: string, symbol?: string): ApiSource[] {
    let sources: ApiSource[];
    
    const custom = this.customPriorities.get(toolName);
    if (custom) {
      sources = custom;
    } else {
      sources = OPTIMAL_SOURCE_MAP[toolName] || ['finnhub'];
    }
    
    if (symbol) {
      const market = getMarketFromSymbol(symbol);
      const marketSources = MARKET_SOURCE_FILTER[market];
      sources = sources.filter(s => marketSources.includes(s));
      
      if (sources.length === 0) {
        sources = marketSources;
      }
      
      logger.debug('Sources filtered by market', { toolName, symbol, market, sources });
    }
    
    return sources;
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
  
  getMarketSources(market: Market): ApiSource[] {
    return MARKET_SOURCE_FILTER[market] || MARKET_SOURCE_FILTER['UNKNOWN'];
  }
}

export const sourceRouter = new SourceRouter();
