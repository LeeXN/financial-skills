import type { ApiSource } from '../types.js';
import { logger } from '../logger.js';

export type Market = 'US' | 'SH' | 'SZ' | 'BJ' | 'HK' | 'UNKNOWN';

const MARKET_SOURCE_MAP: Record<Market, ApiSource[]> = {
  'US': ['finnhub', 'twelvedata', 'tiingo', 'alphavantage'],
  'SH': ['sina', 'eastmoney'],
  'SZ': ['sina', 'eastmoney'],
  'BJ': ['sina', 'eastmoney'],
  'HK': ['finnhub', 'twelvedata', 'sina'],
  'UNKNOWN': ['finnhub', 'alphavantage'],
};

export function getMarketFromSymbol(symbol: string): Market {
  const upper = symbol.toUpperCase();

  if (upper.endsWith('.SH') || upper.endsWith('.SS')) return 'SH';
  if (upper.endsWith('.SZ')) return 'SZ';
  if (upper.endsWith('.BJ')) return 'BJ';
  if (upper.endsWith('.HK')) return 'HK';
  if (upper.endsWith('.US') || upper.endsWith('.N') || upper.endsWith('.O')) return 'US';

  if (/^SH\d{6}$/i.test(symbol)) return 'SH';
  if (/^SZ\d{6}$/i.test(symbol)) return 'SZ';
  if (/^BJ\d{6}$/i.test(symbol)) return 'BJ';

  const code = symbol.replace(/\D/g, '');
  if (code.length === 6) {
    const prefix = code.substring(0, 1);
    if (prefix === '6' || prefix === '5') return 'SH';
    if (prefix === '0' || prefix === '3' || prefix === '2') return 'SZ';
    if (prefix === '4' || prefix === '8') return 'BJ';
  }

  if (code.length === 5 && /^\d{5}$/.test(code)) return 'HK';

  if (/^[A-Z]{1,5}$/.test(symbol)) return 'US';

  return 'UNKNOWN';
}

export function getSourcesForMarket(market: Market): ApiSource[] {
  return MARKET_SOURCE_MAP[market] || MARKET_SOURCE_MAP['UNKNOWN'];
}

export function getSourcesForSymbol(symbol: string): ApiSource[] {
  const market = getMarketFromSymbol(symbol);
  const sources = getSourcesForMarket(market);
  logger.debug('Market routing', { symbol, market, sources });
  return sources;
}

export function isChineseAShare(symbol: string): boolean {
  const market = getMarketFromSymbol(symbol);
  return market === 'SH' || market === 'SZ' || market === 'BJ';
}

export function isUSStock(symbol: string): boolean {
  return getMarketFromSymbol(symbol) === 'US';
}

export function isHKStock(symbol: string): boolean {
  return getMarketFromSymbol(symbol) === 'HK';
}

export class MarketRouter {
  private customMarketSources: Map<Market, ApiSource[]> = new Map();

  constructor() {
    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    const markets: Market[] = ['US', 'SH', 'SZ', 'BJ', 'HK'];
    for (const market of markets) {
      const envKey = `MARKET_SOURCES_${market}`;
      const envValue = process.env[envKey];
      if (envValue) {
        const sources = envValue.split(',')
          .map(s => s.trim().toLowerCase() as ApiSource)
          .filter(Boolean);
        if (sources.length > 0) {
          this.customMarketSources.set(market, sources);
          logger.debug('Custom market sources loaded', { market, sources });
        }
      }
    }
  }

  getSourcesForSymbol(symbol: string): ApiSource[] {
    const market = getMarketFromSymbol(symbol);
    const custom = this.customMarketSources.get(market);
    if (custom) {
      return custom;
    }
    return MARKET_SOURCE_MAP[market] || MARKET_SOURCE_MAP['UNKNOWN'];
  }

  setMarketSources(market: Market, sources: ApiSource[]): void {
    this.customMarketSources.set(market, sources);
  }

  getMarket(symbol: string): Market {
    return getMarketFromSymbol(symbol);
  }
}

export const marketRouter = new MarketRouter();
