import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FinnhubClient } from '../api/finnhub.js';
import { AlphaVantageClient } from '../api/alphavantage.js';
import { TwelveDataClient } from '../api/twelvedata.js';
import { TiingoClient } from '../api/tiingo.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('API Client Tests - Interface Fixes Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FinnhubClient', () => {
    const client = new FinnhubClient('test-api-key');

    it('should use correct API endpoint with /v1 prefix', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ c: 150.5, d: 2.5, dp: 1.69, h: 152, l: 149, o: 149.5, pc: 148 }),
      });

      await client.getStockQuote('AAPL');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('https://finnhub.io/api/v1/quote');
      expect(calledUrl).toContain('symbol=AAPL');
    });

    it('should pass symbol as string parameter, not object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ c: 150.5, d: 2.5, dp: 1.69, h: 152, l: 149, o: 149.5, pc: 148 }),
      });

      await client.getStockQuote('AAPL');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).not.toContain('[object');
      expect(calledUrl).not.toContain('Object]');
    });

    it('should have getQuote alias that returns same result as getStockQuote', async () => {
      const mockResponse = { c: 150.5, d: 2.5, dp: 1.69, h: 152, l: 149, o: 149.5, pc: 148 };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const quoteResult = await client.getQuote('AAPL');
      const stockQuoteResult = await client.getStockQuote('AAPL');

      expect(quoteResult).toEqual(stockQuoteResult);
    });

    it('should return correctly structured StockQuote', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ c: 150.5, d: 2.5, dp: 1.69, h: 152, l: 149, o: 149.5, pc: 148 }),
      });

      const result = await client.getStockQuote('AAPL');

      expect(result).toEqual({
        symbol: 'AAPL',
        currentPrice: 150.5,
        change: 2.5,
        percentChange: 1.69,
        highPriceOfDay: 152,
        lowPriceOfDay: 149,
        openPriceOfDay: 149.5,
        previousClosePrice: 148,
      });
    });
  });

  describe('AlphaVantageClient', () => {
    const client = new AlphaVantageClient('test-api-key');

    it('should correctly parse nested Global Quote response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '02. open': '149.50',
            '03. high': '152.00',
            '04. low': '149.00',
            '05. price': '150.50',
            '08. previous close': '148.00',
            '09. change': '2.50',
            '10. change percent': '1.69%',
          },
        }),
      });

      const result = await client.getQuote('AAPL');

      expect(result.currentPrice).toBe(150.5);
      expect(result.change).toBe(2.5);
      expect(result.percentChange).toBe(1.69);
      expect(result.symbol).toBe('AAPL');
    });

    it('should handle missing Global Quote gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await client.getQuote('AAPL');

      expect(result.currentPrice).toBe(0);
      expect(result.symbol).toBe('AAPL');
    });

    it('should have getStockQuote alias', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          'Global Quote': {
            '01. symbol': 'AAPL',
            '05. price': '150.50',
          },
        }),
      });

      const quoteResult = await client.getQuote('AAPL');
      const stockQuoteResult = await client.getStockQuote('AAPL');

      expect(quoteResult.currentPrice).toEqual(stockQuoteResult.currentPrice);
    });

    it('should strip percent sign from change percent', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          'Global Quote': {
            '10. change percent': '5.25%',
          },
        }),
      });

      const result = await client.getQuote('AAPL');

      expect(result.percentChange).toBe(5.25);
    });
  });

  describe('TwelveDataClient', () => {
    const client = new TwelveDataClient('test-api-key');

    it('should pass symbol as query parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          symbol: 'AAPL',
          open: '149.50',
          high: '152.00',
          low: '149.00',
          close: '150.50',
          previous_close: '148.00',
          change: '2.50',
          percent_change: '1.69',
        }),
      });

      await client.getStockQuote('AAPL');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('symbol=AAPL');
      expect(calledUrl).not.toContain('[object');
    });

    it('should have getQuote alias', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          symbol: 'AAPL',
          close: '150.50',
          change: '2.50',
          percent_change: '1.69',
          high: '152.00',
          low: '149.00',
          open: '149.50',
          previous_close: '148.00',
        }),
      });

      expect(typeof client.getQuote).toBe('function');

      const result = await client.getQuote('AAPL');
      expect(result.currentPrice).toBe(150.5);
    });
  });

  describe('TiingoClient', () => {
    const client = new TiingoClient('test-api-key');

    it('should pass symbol in URL path correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([{
          ticker: 'AAPL',
          tngoLast: 150.5,
          open: 149.5,
          high: 152,
          low: 149,
          prevClose: 148,
        }]),
      });

      await client.getQuote('AAPL');

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('/iex/AAPL');
      expect(calledUrl).not.toContain('[object');
      expect(calledUrl).not.toContain('Object]');
    });

    it('should have getStockQuote alias', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{
          ticker: 'AAPL',
          tngoLast: 150.5,
          open: 149.5,
          high: 152,
          low: 149,
          prevClose: 148,
        }]),
      });

      expect(typeof client.getStockQuote).toBe('function');

      const result = await client.getStockQuote('AAPL');
      expect(result.currentPrice).toBe(150.5);
    });

    it('should throw meaningful error for empty response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await expect(client.getQuote('INVALID')).rejects.toThrow('No data found for symbol INVALID');
    });
  });
});
