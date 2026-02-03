import type * as types from '../types.js';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export class FinnhubClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || FINNHUB_API_KEY;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'X-Finnhub-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getStockQuote(symbol: string): Promise<types.StockQuote> {
    const data = await this.request<{ c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number }>('/quote', { symbol });
    return {
      symbol,
      currentPrice: data.c,
      change: data.d,
      percentChange: data.dp,
      highPriceOfDay: data.h,
      lowPriceOfDay: data.l,
      openPriceOfDay: data.o,
      previousClosePrice: data.pc,
    };
  }

  async getQuote(symbol: string): Promise<types.StockQuote> {
    return this.getStockQuote(symbol);
  }

  async getStockCandles(symbol: string, resolution: string = 'D', from: number, to: number): Promise<types.HistoricalPrice[]> {
    const data = await this.request<{ s: types.HistoricalPrice[]; t: number; c?: types.HistoricalPrice[] }>('/stock/candle', {
      symbol,
      resolution,
      from: from.toString(),
      to: to.toString(),
    });
    return data.s;
  }

  async getCompanyBasicFinancials(symbol: string): Promise<types.CompanyFinancials> {
    return this.request('/stock/metric', { symbol, metric: 'all' });
  }

  async getCompanyMetrics(symbol: string, metricType: string = 'all'): Promise<types.CompanyInfo> {
    return this.request('/stock/metric', { symbol, metric: metricType });
  }

  async getNews(symbol: string, category?: string, minId?: number): Promise<types.NewsItem[]> {
    const now = Math.floor(Date.now() / 1000);
    const oneMonthAgo = now - 30 * 24 * 60 * 60;
    const params: Record<string, string> = {
      symbol,
      from: new Date(oneMonthAgo * 1000).toISOString().split('T')[0],
      to: new Date(now * 1000).toISOString().split('T')[0],
    };
    return this.request('/company-news', params);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getStockQuote('HEALTH_TEST');
      return true;
    } catch {
      return false;
    }
  }
}
