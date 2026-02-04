/**
 * Sina Finance API client - provides real-time quotes and historical data for Chinese A-shares
 * API docs: Unofficial - based on public endpoints
 * 
 * Note: This is a free public API without API keys. Rate limiting is IP-based.
 * Supports: Shanghai (sh), Shenzhen (sz), Beijing (bj) exchanges
 */

import type * as types from '../types.js';
import { logger } from '../logger.js';

const SINA_QUOTE_URL = 'https://hq.sinajs.cn/list=';
const SINA_KLINE_URL = 'https://quotes.sina.cn/cn/api/jsonp_v2.php/=/CN_MarketDataService.getKLineData';
const SINA_DAILY_URL = 'https://finance.sina.com.cn/realstock/company';

// Required header to avoid 403
const SINA_REFERER = 'https://finance.sina.com.cn/';

export interface SinaClientConfig {
  /** Request interval in ms to avoid IP ban (default: 200ms) */
  requestIntervalMs?: number;
  /** Proxy URL for requests (optional) */
  proxyUrl?: string;
  /** User agent string */
  userAgent?: string;
}

export class SinaClient {
  private lastRequestTime: number = 0;
  private readonly requestIntervalMs: number;
  private readonly proxyUrl?: string;
  private readonly userAgent: string;

  constructor(config?: SinaClientConfig) {
    this.requestIntervalMs = config?.requestIntervalMs ?? 200;
    this.proxyUrl = config?.proxyUrl;
    this.userAgent = config?.userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  /**
   * Rate limit control - wait if needed before making request
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.requestIntervalMs) {
      const waitTime = this.requestIntervalMs - elapsed;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * Make HTTP request with rate limiting and required headers
   */
  private async request(url: string): Promise<string> {
    await this.waitForRateLimit();

    const headers: Record<string, string> = {
      'Referer': SINA_REFERER,
      'User-Agent': this.userAgent,
    };

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`Sina API error: ${response.status} ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      logger.debug('Sina request failed', { url, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Normalize symbol format to Sina format
   * Input: 601899.SH, 601899.SS, sh601899, 601899
   * Output: sh601899
   */
  private normalizeSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase();
    
    // Already in sina format: sh601899, sz000001
    if (/^(SH|SZ|BJ)\d{6}$/i.test(symbol)) {
      return symbol.toLowerCase();
    }
    
    // Format: 601899.SH or 601899.SS (Shanghai)
    if (upperSymbol.endsWith('.SH') || upperSymbol.endsWith('.SS')) {
      return 'sh' + upperSymbol.slice(0, -3);
    }
    
    // Format: 000001.SZ (Shenzhen)
    if (upperSymbol.endsWith('.SZ')) {
      return 'sz' + upperSymbol.slice(0, -3);
    }
    
    // Format: 430047.BJ (Beijing)
    if (upperSymbol.endsWith('.BJ')) {
      return 'bj' + upperSymbol.slice(0, -3);
    }
    
    // Pure number - guess exchange based on code range
    const code = symbol.replace(/\D/g, '');
    if (code.length === 6) {
      const prefix = code.substring(0, 1);
      // Shanghai: 6xxxxx, 5xxxxx (ETF)
      if (prefix === '6' || prefix === '5') {
        return 'sh' + code;
      }
      // Shenzhen: 0xxxxx, 3xxxxx (ChiNext), 2xxxxx (B-share)
      if (prefix === '0' || prefix === '3' || prefix === '2') {
        return 'sz' + code;
      }
      // Beijing: 4xxxxx, 8xxxxx
      if (prefix === '4' || prefix === '8') {
        return 'bj' + code;
      }
    }
    
    // Default: return as-is
    return symbol.toLowerCase();
  }

  /**
   * Parse Sina quote response
   * Format: var hq_str_sh601899="紫金矿业,14.58,14.55,14.43,-0.12,-0.82,14.43,14.44,..."
   */
  private parseQuoteResponse(text: string, symbol: string): types.StockQuote {
    // Extract the data string between quotes
    const match = text.match(/="([^"]*)"/);
    if (!match || !match[1]) {
      throw new Error(`Sina API error: No data found for symbol ${symbol}`);
    }

    const data = match[1];
    if (!data || data.trim() === '') {
      throw new Error(`Sina API error: Empty data for symbol ${symbol}`);
    }

    const fields = data.split(',');
    
    // Sina A-share format has 33 fields
    // 0: 股票名称
    // 1: 今日开盘价
    // 2: 昨日收盘价
    // 3: 当前价格
    // 4: 今日最高价
    // 5: 今日最低价
    // 6: 买一价
    // 7: 卖一价
    // 8: 成交量（股）
    // 9: 成交额（元）
    
    const currentPrice = parseFloat(fields[3]) || 0;
    const previousClose = parseFloat(fields[2]) || 0;
    const change = currentPrice - previousClose;
    const percentChange = previousClose !== 0 ? (change / previousClose) * 100 : 0;

    return {
      symbol,
      currentPrice,
      change: parseFloat(change.toFixed(2)),
      percentChange: parseFloat(percentChange.toFixed(2)),
      highPriceOfDay: parseFloat(fields[4]) || 0,
      lowPriceOfDay: parseFloat(fields[5]) || 0,
      openPriceOfDay: parseFloat(fields[1]) || 0,
      previousClosePrice: previousClose,
    };
  }

  /**
   * Get real-time stock quote
   */
  async getStockQuote(symbol: string): Promise<types.StockQuote> {
    const sinaSymbol = this.normalizeSymbol(symbol);
    const url = `${SINA_QUOTE_URL}${sinaSymbol}`;
    
    logger.debug('Sina getStockQuote', { symbol, sinaSymbol });
    
    const text = await this.request(url);
    return this.parseQuoteResponse(text, symbol);
  }

  /**
   * Alias for getStockQuote
   */
  async getQuote(symbol: string): Promise<types.StockQuote> {
    return this.getStockQuote(symbol);
  }

  /**
   * Get historical K-line data (candles)
   * @param symbol Stock symbol
   * @param resolution Time resolution: 1, 5, 15, 30, 60 (minutes) or D (daily)
   * @param from Start timestamp (seconds)
   * @param to End timestamp (seconds)
   */
  async getStockCandles(
    symbol: string,
    resolution: string = 'D',
    from: number,
    to: number
  ): Promise<types.HistoricalPrice[]> {
    const sinaSymbol = this.normalizeSymbol(symbol);
    
    // For daily data, use different endpoint
    if (resolution.toUpperCase() === 'D') {
      return this.getDailyCandles(sinaSymbol, from, to);
    }
    
    // For intraday, use minute K-line API
    const scale = resolution === '60' ? '60' : resolution;
    const datalen = Math.min(Math.ceil((to - from) / 60 / parseInt(scale || '1')), 1970);
    
    const url = `${SINA_KLINE_URL}?symbol=${sinaSymbol}&scale=${scale}&ma=no&datalen=${datalen}`;
    
    logger.debug('Sina getStockCandles', { symbol, sinaSymbol, resolution, datalen });
    
    const text = await this.request(url);
    
    try {
      // Response format: =([{...}, {...}]);
      const jsonStr = text.match(/\((\[.*\])\)/)?.[1];
      if (!jsonStr) {
        return [];
      }
      
      const data = JSON.parse(jsonStr) as Array<{
        day: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
      }>;
      
      return data
        .filter(item => {
          const timestamp = new Date(item.day).getTime() / 1000;
          return timestamp >= from && timestamp <= to;
        })
        .map(item => ({
          date: item.day,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume),
        }));
    } catch (error) {
      logger.debug('Sina parseStockCandles failed', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get daily candle data
   */
  private async getDailyCandles(
    sinaSymbol: string,
    from: number,
    to: number
  ): Promise<types.HistoricalPrice[]> {
    // Use the minute API with daily scale for simplicity
    // The full historical API requires JS decryption which is complex
    const datalen = Math.min(Math.ceil((to - from) / 86400), 1000);
    const url = `${SINA_KLINE_URL}?symbol=${sinaSymbol}&scale=240&ma=no&datalen=${datalen}`;
    
    const text = await this.request(url);
    
    try {
      const jsonStr = text.match(/\((\[.*\])\)/)?.[1];
      if (!jsonStr) {
        return [];
      }
      
      const data = JSON.parse(jsonStr) as Array<{
        day: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
      }>;
      
      // Group by date (for 240min = 1 trading day)
      const dailyMap = new Map<string, types.HistoricalPrice>();
      
      for (const item of data) {
        const date = item.day.split(' ')[0];
        const existing = dailyMap.get(date);
        
        if (!existing) {
          dailyMap.set(date, {
            date,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume),
          });
        } else {
          // Update high/low/close/volume for the same day
          existing.high = Math.max(existing.high, parseFloat(item.high));
          existing.low = Math.min(existing.low, parseFloat(item.low));
          existing.close = parseFloat(item.close);
          existing.volume += parseFloat(item.volume);
        }
      }
      
      return Array.from(dailyMap.values())
        .filter(item => {
          const timestamp = new Date(item.date).getTime() / 1000;
          return timestamp >= from && timestamp <= to;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      logger.debug('Sina getDailyCandles failed', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get daily prices in Record format (compatible with other clients)
   */
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

  /**
   * Get multiple quotes at once (batch request)
   */
  async getBatchQuotes(symbols: string[]): Promise<Map<string, types.StockQuote>> {
    const sinaSymbols = symbols.map(s => this.normalizeSymbol(s));
    const url = `${SINA_QUOTE_URL}${sinaSymbols.join(',')}`;
    
    logger.debug('Sina getBatchQuotes', { count: symbols.length });
    
    const text = await this.request(url);
    const results = new Map<string, types.StockQuote>();
    
    // Split by lines and parse each
    const lines = text.split('\n').filter(line => line.includes('var hq_str_'));
    
    for (let i = 0; i < lines.length && i < symbols.length; i++) {
      try {
        const quote = this.parseQuoteResponse(lines[i], symbols[i]);
        results.set(symbols[i], quote);
      } catch (error) {
        logger.debug('Sina parseBatchQuote failed', { symbol: symbols[i], error: (error as Error).message });
      }
    }
    
    return results;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.getStockQuote('sh000001'); // Shanghai Index
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update proxy URL at runtime
   */
  setProxyUrl(proxyUrl: string | undefined): void {
    (this as any).proxyUrl = proxyUrl;
  }
}
