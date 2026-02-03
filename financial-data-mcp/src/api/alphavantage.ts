import type * as types from '../types.js';

const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY || '';
const ALPHAVANTAGE_BASE_URL = 'https://www.alphavantage.co/query';

export class AlphaVantageClient {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || ALPHAVANTAGE_API_KEY;
  }

  private async request(functionName: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(ALPHAVANTAGE_BASE_URL);
    url.searchParams.append('function', functionName);
    url.searchParams.append('apikey', this.apiKey);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'financial-data-mcp/1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Alpha Vantage API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getDailyPrices(symbol: string, outputsize: 'compact' | 'full' = 'compact'): Promise<Record<string, types.HistoricalPrice>> {
    const data = await this.request('TIME_SERIES_DAILY', { symbol, outputsize });
    const timeSeries = data['Time Series (Daily)'];
    const result: Record<string, types.HistoricalPrice> = {};

    Object.entries(timeSeries).forEach(([date, values]: [string, any]) => {
      if (typeof values === 'object' && values !== null) {
        result[date] = {
          date,
          open: parseFloat(values['1. open'] || '0'),
          high: parseFloat(values['2. high'] || '0'),
          low: parseFloat(values['3. low'] || '0'),
          close: parseFloat(values['4. close'] || '0'),
          volume: parseFloat(values['5. volume'] || '0'),
        };
      }
    });

    return result;
  }

  async getQuote(symbol: string): Promise<types.StockQuote> {
    const data = await this.request('GLOBAL_QUOTE', { symbol });
    const quote = data['Global Quote'] || {};
    return {
      symbol: quote['01. symbol'] || symbol,
      currentPrice: parseFloat(quote['05. price']) || 0,
      change: parseFloat(quote['09. change']) || 0,
      percentChange: parseFloat((quote['10. change percent'] || '').replace('%', '')) || 0,
      highPriceOfDay: parseFloat(quote['03. high']) || 0,
      lowPriceOfDay: parseFloat(quote['04. low']) || 0,
      openPriceOfDay: parseFloat(quote['02. open']) || 0,
      previousClosePrice: parseFloat(quote['08. previous close']) || 0,
    };
  }

  async getStockQuote(symbol: string): Promise<types.StockQuote> {
    return this.getQuote(symbol);
  }

  async getCompanyOverview(symbol: string): Promise<types.CompanyInfo> {
    const data = await this.request('OVERVIEW', { symbol });
    return {
      symbol: data['02. Symbol'] || data['01. symbol'] || symbol,
      companyName: data['01. symbol'] || data['02. Symbol'] || symbol,
      industry: data['08. Industry'],
      sector: data['10. Sector'],
      marketCap: parseFloat(data['06. Market Capitalization'] || '0'),
      sharesOutstanding: parseFloat(data['05. Shares Outstanding'] || '0'),
      description: data['11. Description'],
    };
  }

  async getIncomeStatement(symbol: string): Promise<any> {
    return this.request('INCOME_STATEMENT', { symbol });
  }

  async getBalanceSheet(symbol: string): Promise<any> {
    return this.request('BALANCE_SHEET', { symbol });
  }

  async getCashFlow(symbol: string): Promise<any> {
    return this.request('CASH_FLOW', { symbol });
  }

  async getTechnicalIndicator(symbol: string, indicator: string, interval: string = 'daily', time_period: string = '14'): Promise<types.TechnicalIndicator> {
    const data = await this.request(indicator, { symbol, interval, time_period, series_type: 'close' });
    return {
      indicator,
      symbol,
      data: data[`Technical Analysis: ${indicator}`] || {},
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.getQuote('HEALTH_TEST');
      return true;
    } catch {
      return false;
    }
  }
}
