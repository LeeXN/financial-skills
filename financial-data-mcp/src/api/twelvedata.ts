/**
 * TwelveData API client - provides real-time quotes, historical data, and technical indicators
 * API docs: https://twelvedata.com/docs
 */

import type * as types from '../types.js';

const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || '';
const TWELVEDATA_BASE_URL = 'https://api.twelvedata.com';

export class TwelveDataClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || TWELVEDATA_API_KEY;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${TWELVEDATA_BASE_URL}${endpoint}`);
    url.searchParams.append('apikey', this.apiKey);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`TwelveData API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(`TwelveData API error: ${data.message || 'Unknown error'}`);
    }

    return data;
  }

  async getStockQuote(symbol: string): Promise<types.StockQuote> {
    const data = await this.request<{
      symbol: string;
      name: string;
      open: string;
      high: string;
      low: string;
      close: string;
      previous_close: string;
      change: string;
      percent_change: string;
    }>('/quote', { symbol });

    return {
      symbol: data.symbol,
      currentPrice: parseFloat(data.close),
      change: parseFloat(data.change),
      percentChange: parseFloat(data.percent_change),
      highPriceOfDay: parseFloat(data.high),
      lowPriceOfDay: parseFloat(data.low),
      openPriceOfDay: parseFloat(data.open),
      previousClosePrice: parseFloat(data.previous_close),
    };
  }

  async getQuote(symbol: string): Promise<types.StockQuote> {
    return this.getStockQuote(symbol);
  }

  async getStockCandles(
    symbol: string,
    resolution: string = '1day',
    from: number,
    to: number
  ): Promise<types.HistoricalPrice[]> {
    const intervalMap: Record<string, string> = {
      '1': '1min',
      '5': '5min',
      '15': '15min',
      '60': '1h',
      'D': '1day',
      'W': '1week',
      'M': '1month',
    };

    const interval = intervalMap[resolution] || resolution;
    const fromDate = new Date(from * 1000).toISOString().split('T')[0];
    const toDate = new Date(to * 1000).toISOString().split('T')[0];

    const data = await this.request<{
      values: Array<{
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
        volume: string;
      }>;
    }>('/time_series', {
      symbol,
      interval,
      start_date: fromDate,
      end_date: toDate,
      outputsize: '5000',
    });

    if (!data.values) {
      return [];
    }

    return data.values.map((candle) => ({
      date: candle.datetime,
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume),
    }));
  }

  async getTechnicalIndicator(
    symbol: string,
    indicator: string,
    interval: string = 'daily',
    time_period: string = '14'
  ): Promise<types.TechnicalIndicator> {
    const intervalMap: Record<string, string> = {
      'daily': '1day',
      'weekly': '1week',
      'monthly': '1month',
      '1min': '1min',
      '5min': '5min',
      '15min': '15min',
      '60min': '1h',
    };

    const mappedInterval = intervalMap[interval] || interval;
    const indicatorLower = indicator.toLowerCase();

    const data = await this.request<{
      values: Array<Record<string, string>>;
    }>(`/${indicatorLower}`, {
      symbol,
      interval: mappedInterval,
      time_period,
      outputsize: '100',
    });

    const result: Record<string, number> = {};
    if (data.values && data.values.length > 0) {
      data.values.forEach((value, index) => {
        const datetime = value.datetime || `${index}`;
        const indicatorValue = value[indicatorLower] || value.macd || value.macd_signal || Object.values(value).find(v => !isNaN(parseFloat(v)));
        if (indicatorValue) {
          result[datetime] = parseFloat(indicatorValue);
        }
      });
    }

    return {
      indicator,
      symbol,
      data: result,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('/quote', { symbol: 'AAPL' });
      return true;
    } catch {
      return false;
    }
  }
}
