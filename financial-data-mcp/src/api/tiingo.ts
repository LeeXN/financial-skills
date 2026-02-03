/**
 * Tiingo API client - provides IEX quotes, historical EOD data, and news
 * API docs: https://www.tiingo.com/documentation
 */

import type * as types from '../types.js';

const TIINGO_API_KEY = process.env.TIINGO_API_KEY || '';
const TIINGO_BASE_URL = 'https://api.tiingo.com';

export class TiingoClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || TIINGO_API_KEY;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TIINGO_BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    // Try with Authorization header first
    let response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    // If 403 Forbidden, fallback to token as query param
    if (response.status === 403) {
      url.searchParams.append('token', this.apiKey);
      response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Tiingo API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getQuote(symbol: string): Promise<types.StockQuote> {
    const data = await this.request<Array<{
      ticker: string;
      tngoLast: number;
      last: number;
      open: number;
      high: number;
      low: number;
      prevClose: number;
    }>>(`/iex/${symbol}`);

    if (!data || data.length === 0) {
      throw new Error(`Tiingo API error: No data found for symbol ${symbol}`);
    }

    const quote = data[0];
    const currentPrice = quote.tngoLast || quote.last || 0;
    const previousClose = quote.prevClose || 0;
    const change = currentPrice - previousClose;
    const percentChange = previousClose ? (change / previousClose) * 100 : 0;

    return {
      symbol: quote.ticker || symbol,
      currentPrice,
      change,
      percentChange,
      highPriceOfDay: quote.high || 0,
      lowPriceOfDay: quote.low || 0,
      openPriceOfDay: quote.open || 0,
      previousClosePrice: previousClose,
    };
  }

  async getStockQuote(symbol: string): Promise<types.StockQuote> {
    return this.getQuote(symbol);
  }

  async getStockCandles(
    symbol: string,
    resolution: string = 'D',
    from: number,
    to: number
  ): Promise<types.HistoricalPrice[]> {
    const fromDate = new Date(from * 1000).toISOString().split('T')[0];
    const toDate = new Date(to * 1000).toISOString().split('T')[0];

    const data = await this.request<Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      adjClose: number;
    }>>(`/tiingo/daily/${symbol}/prices`, {
      startDate: fromDate,
      endDate: toDate,
    });

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map((price) => ({
      date: price.date.split('T')[0],
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close,
      volume: price.volume,
      adjustedClose: price.adjClose,
    }));
  }

  async getDailyPrices(
    symbol: string,
    outputsize: 'compact' | 'full' = 'compact'
  ): Promise<Record<string, types.HistoricalPrice>> {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (outputsize === 'compact' ? 100 : 365 * 5) * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const data = await this.request<Array<{
      date: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      adjClose: number;
    }>>(`/tiingo/daily/${symbol}/prices`, {
      startDate,
      endDate,
    });

    const result: Record<string, types.HistoricalPrice> = {};
    if (data && Array.isArray(data)) {
      data.forEach((price) => {
        const date = price.date.split('T')[0];
        result[date] = {
          date,
          open: price.open,
          high: price.high,
          low: price.low,
          close: price.close,
          volume: price.volume,
          adjustedClose: price.adjClose,
        };
      });
    }

    return result;
  }

  async getNews(symbol: string, category?: string, minId?: number): Promise<types.NewsItem[]> {
    const params: Record<string, string> = { tickers: symbol };
    if (minId) {
      params.offset = minId.toString();
    }

    const data = await this.request<Array<{
      id: number;
      title: string;
      description: string;
      url: string;
      publishedDate: string;
      source: string;
      tags: string[];
    }>>('/tiingo/news', params);

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map((item) => ({
      id: item.id,
      headline: item.title,
      summary: item.description,
      url: item.url,
      datetime: new Date(item.publishedDate).getTime() / 1000,
      source: item.source,
      category: item.tags?.[0] || category,
      related: symbol,
    }));
  }

  async getCompanyOverview(symbol: string): Promise<types.CompanyInfo> {
    const data = await this.request<{
      ticker: string;
      name: string;
      description: string;
      exchangeCode: string;
      startDate: string;
      endDate: string;
    }>(`/tiingo/daily/${symbol}`);

    return {
      symbol: data.ticker || symbol,
      companyName: data.name || symbol,
      description: data.description,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/iex/AAPL');
      return true;
    } catch {
      return false;
    }
  }
}
