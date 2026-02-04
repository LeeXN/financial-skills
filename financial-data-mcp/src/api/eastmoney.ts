/**
 * East Money (东方财富) API client - provides real-time quotes and intraday data for Chinese A-shares
 * API docs: Unofficial - based on public endpoints
 * 
 * Note: This is a free public API without API keys. Rate limiting is IP-based.
 * Supports: Shanghai (SH), Shenzhen (SZ), Beijing (BJ) exchanges
 */

import type * as types from '../types.js';
import { logger } from '../logger.js';

const EM_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get';
const EM_KLINE_URL = 'https://push2his.eastmoney.com/api/qt/stock/kline/get';
const EM_BATCH_URL = 'https://push2.eastmoney.com/api/qt/ulist.np/get';

export interface EastMoneyClientConfig {
  requestIntervalMs?: number;
  proxyUrl?: string;
  userAgent?: string;
}

export class EastMoneyClient {
  private lastRequestTime: number = 0;
  private readonly requestIntervalMs: number;
  private readonly proxyUrl?: string;
  private readonly userAgent: string;

  constructor(config?: EastMoneyClientConfig) {
    this.requestIntervalMs = config?.requestIntervalMs ?? 200;
    this.proxyUrl = config?.proxyUrl;
    this.userAgent = config?.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.requestIntervalMs) {
      const waitTime = this.requestIntervalMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  private async request<T>(url: string): Promise<T> {
    await this.waitForRateLimit();

    const headers: Record<string, string> = {
      'User-Agent': this.userAgent,
      'Referer': 'https://quote.eastmoney.com/',
    };

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`EastMoney API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.debug('EastMoney request failed', { url, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Convert symbol to EastMoney format
   * EastMoney uses: 1.600519 (Shanghai), 0.000001 (Shenzhen), 0.430047 (Beijing)
   * secid format: {market}.{code}
   * market: 0=Shenzhen, 1=Shanghai, 0=Beijing(8/4开头)
   */
  private normalizeSymbol(symbol: string): { secid: string; code: string } {
    const upperSymbol = symbol.toUpperCase();
    let code: string;
    let market: number;

    if (/^(SH|SZ|BJ)\d{6}$/i.test(symbol)) {
      const prefix = symbol.substring(0, 2).toUpperCase();
      code = symbol.substring(2);
      market = prefix === 'SH' ? 1 : 0;
    } else if (upperSymbol.endsWith('.SH') || upperSymbol.endsWith('.SS')) {
      code = upperSymbol.slice(0, -3);
      market = 1;
    } else if (upperSymbol.endsWith('.SZ')) {
      code = upperSymbol.slice(0, -3);
      market = 0;
    } else if (upperSymbol.endsWith('.BJ')) {
      code = upperSymbol.slice(0, -3);
      market = 0;
    } else {
      code = symbol.replace(/\D/g, '');
      if (code.length === 6) {
        const prefix = code.substring(0, 1);
        market = (prefix === '6' || prefix === '5') ? 1 : 0;
      } else {
        market = 1;
      }
    }

    return { secid: `${market}.${code}`, code };
  }

  async getStockQuote(symbol: string): Promise<types.StockQuote> {
    const { secid, code } = this.normalizeSymbol(symbol);
    
    const params = new URLSearchParams({
      secid,
      fields: 'f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f116,f117,f168,f169,f170',
      invt: '2',
      fltt: '1',
    });

    const url = `${EM_QUOTE_URL}?${params}`;
    
    logger.debug('EastMoney getStockQuote', { symbol, secid });

    interface EMQuoteResponse {
      data?: {
        f43?: number;  // current price * 1000
        f44?: number;  // high * 1000
        f45?: number;  // low * 1000
        f46?: number;  // open * 1000
        f47?: number;  // volume
        f48?: number;  // amount
        f50?: number;  // volume ratio
        f51?: number;  // limit up * 1000
        f52?: number;  // limit down * 1000
        f57?: string;  // code
        f58?: string;  // name
        f60?: number;  // previous close * 1000
        f116?: number; // market cap
        f117?: number; // circulating market cap
        f168?: number; // turnover rate
        f169?: number; // change * 1000
        f170?: number; // change percent * 100
      };
    }

    const response = await this.request<EMQuoteResponse>(url);
    
    if (!response.data) {
      throw new Error(`EastMoney API error: No data found for symbol ${symbol}`);
    }

    const d = response.data;
    const divisor = 1000;

    return {
      symbol,
      currentPrice: (d.f43 ?? 0) / divisor,
      change: (d.f169 ?? 0) / divisor,
      percentChange: (d.f170 ?? 0) / 100,
      highPriceOfDay: (d.f44 ?? 0) / divisor,
      lowPriceOfDay: (d.f45 ?? 0) / divisor,
      openPriceOfDay: (d.f46 ?? 0) / divisor,
      previousClosePrice: (d.f60 ?? 0) / divisor,
    };
  }

  async getQuote(symbol: string): Promise<types.StockQuote> {
    return this.getStockQuote(symbol);
  }

  async getStockCandles(
    symbol: string,
    resolution: string = 'D',
    from: number,
    to: number
  ): Promise<types.HistoricalPrice[]> {
    const { secid } = this.normalizeSymbol(symbol);
    
    const kltMap: Record<string, string> = {
      '1': '1',
      '5': '5',
      '15': '15',
      '30': '30',
      '60': '60',
      'D': '101',
      'W': '102',
      'M': '103',
    };
    
    const klt = kltMap[resolution.toUpperCase()] ?? '101';
    const fromDate = new Date(from * 1000).toISOString().split('T')[0].replace(/-/g, '');
    const toDate = new Date(to * 1000).toISOString().split('T')[0].replace(/-/g, '');
    
    const params = new URLSearchParams({
      secid,
      fields1: 'f1,f2,f3,f4,f5,f6',
      fields2: 'f51,f52,f53,f54,f55,f56,f57',
      klt,
      fqt: '1',
      beg: fromDate,
      end: toDate,
    });

    const url = `${EM_KLINE_URL}?${params}`;
    
    logger.debug('EastMoney getStockCandles', { symbol, secid, klt });

    interface EMKlineResponse {
      data?: {
        klines?: string[];
      };
    }

    const response = await this.request<EMKlineResponse>(url);
    
    if (!response.data?.klines) {
      return [];
    }

    return response.data.klines.map(line => {
      const [date, open, close, high, low, volume] = line.split(',');
      return {
        date,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
        volume: parseFloat(volume),
      };
    });
  }

  async getDailyPrices(
    symbol: string,
    outputsize: 'compact' | 'full' = 'compact'
  ): Promise<Record<string, types.HistoricalPrice>> {
    const now = Math.floor(Date.now() / 1000);
    const days = outputsize === 'compact' ? 100 : 365 * 2;
    const from = now - days * 86400;
    
    const candles = await this.getStockCandles(symbol, 'D', from, now);
    
    const result: Record<string, types.HistoricalPrice> = {};
    for (const candle of candles) {
      result[candle.date] = candle;
    }
    
    return result;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getStockQuote('sh000001');
      return true;
    } catch {
      return false;
    }
  }

  setProxyUrl(proxyUrl: string | undefined): void {
    (this as any).proxyUrl = proxyUrl;
  }
}
