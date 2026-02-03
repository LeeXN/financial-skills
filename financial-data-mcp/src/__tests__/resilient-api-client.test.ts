import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResilientApiClient } from '../resilience/resilient-api-client.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ResilientApiClient - Method Compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Method Availability', () => {
    it('should have both getQuote and getStockQuote methods', () => {
      const finnhubMock = {
        getStockQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
        getQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
      };
      const alphaMock = {
        getQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
        getStockQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
      };

      const resilientClient = new ResilientApiClient(finnhubMock as any, alphaMock as any);

      expect(typeof resilientClient.getStockQuote).toBe('function');
      expect(typeof resilientClient.getQuote).toBe('function');
    });
  });

  describe('Executor Pattern', () => {
    it('should create executors that pass symbol as string', async () => {
      const mockGetStockQuote = vi.fn().mockResolvedValue({ currentPrice: 150 });
      
      const finnhubMock = {
        getStockQuote: mockGetStockQuote,
        getQuote: mockGetStockQuote,
      };
      const alphaMock = {
        getQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
        getStockQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
      };

      const resilientClient = new ResilientApiClient(finnhubMock as any, alphaMock as any);

      const executors = resilientClient.createExecutor({ symbol: 'AAPL' });

      expect(executors.get_stock_quote).toBeDefined();
      expect(executors.get_quote).toBeDefined();

      await executors.get_stock_quote('finnhub');
      expect(mockGetStockQuote).toHaveBeenCalledWith('AAPL');
      expect(mockGetStockQuote).not.toHaveBeenCalledWith({ symbol: 'AAPL' });
    });

    it('get_quote executor should fallback to getStockQuote if getQuote not available', async () => {
      const mockGetStockQuote = vi.fn().mockResolvedValue({ currentPrice: 150 });
      
      const finnhubMock = {
        getStockQuote: mockGetStockQuote,
      };
      const alphaMock = {
        getQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
        getStockQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
      };

      const resilientClient = new ResilientApiClient(finnhubMock as any, alphaMock as any);

      const executors = resilientClient.createExecutor({ symbol: 'AAPL' });

      await executors.get_quote('finnhub');
      expect(mockGetStockQuote).toHaveBeenCalledWith('AAPL');
    });

    it('get_stock_quote executor should throw when method not available', async () => {
      const finnhubMock = {};
      const alphaMock = {
        getQuote: vi.fn().mockResolvedValue({ currentPrice: 150 }),
      };

      const resilientClient = new ResilientApiClient(finnhubMock as any, alphaMock as any);

      const executors = resilientClient.createExecutor({ symbol: 'AAPL' });

      try {
        await executors.get_stock_quote('finnhub');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect((error as Error).message).toContain('finnhub does not support get_stock_quote');
      }
    });
  });

  describe('All Methods Have Correct Signatures', () => {
    it('getStockQuote should accept symbol string parameter', async () => {
      const mockGetStockQuote = vi.fn().mockResolvedValue({
        symbol: 'AAPL',
        currentPrice: 150.5,
        change: 2.5,
        percentChange: 1.69,
        highPriceOfDay: 152,
        lowPriceOfDay: 149,
        openPriceOfDay: 149.5,
        previousClosePrice: 148,
      });

      const finnhubMock = { getStockQuote: mockGetStockQuote, getQuote: mockGetStockQuote };
      const alphaMock = { getQuote: mockGetStockQuote, getStockQuote: mockGetStockQuote };

      const resilientClient = new ResilientApiClient(finnhubMock as any, alphaMock as any);
      
      const executors = resilientClient.createExecutor({ symbol: 'AAPL' });
      await executors.get_stock_quote('finnhub');

      expect(mockGetStockQuote).toHaveBeenCalledTimes(1);
      const call = mockGetStockQuote.mock.calls[0];
      expect(typeof call[0]).toBe('string');
      expect(call[0]).toBe('AAPL');
    });

    it('getQuote should accept symbol string parameter', async () => {
      const mockGetQuote = vi.fn().mockResolvedValue({
        symbol: 'AAPL',
        currentPrice: 150.5,
      });

      const finnhubMock = { getStockQuote: mockGetQuote, getQuote: mockGetQuote };
      const alphaMock = { getQuote: mockGetQuote, getStockQuote: mockGetQuote };

      const resilientClient = new ResilientApiClient(finnhubMock as any, alphaMock as any);
      
      const executors = resilientClient.createExecutor({ symbol: 'MSFT' });
      await executors.get_quote('alphavantage');

      expect(mockGetQuote).toHaveBeenCalledWith('MSFT');
    });
  });
});

describe('Client Method Aliases Verification', () => {
  it('should verify FinnhubClient exports getQuote alias', async () => {
    const { FinnhubClient } = await import('../api/finnhub.js');
    const client = new FinnhubClient('test-key');
    expect(typeof client.getQuote).toBe('function');
    expect(typeof client.getStockQuote).toBe('function');
  });

  it('should verify AlphaVantageClient exports getStockQuote alias', async () => {
    const { AlphaVantageClient } = await import('../api/alphavantage.js');
    const client = new AlphaVantageClient('test-key');
    expect(typeof client.getQuote).toBe('function');
    expect(typeof client.getStockQuote).toBe('function');
  });

  it('should verify TwelveDataClient exports getQuote alias', async () => {
    const { TwelveDataClient } = await import('../api/twelvedata.js');
    const client = new TwelveDataClient('test-key');
    expect(typeof client.getQuote).toBe('function');
    expect(typeof client.getStockQuote).toBe('function');
  });

  it('should verify TiingoClient exports getStockQuote alias', async () => {
    const { TiingoClient } = await import('../api/tiingo.js');
    const client = new TiingoClient('test-key');
    expect(typeof client.getQuote).toBe('function');
    expect(typeof client.getStockQuote).toBe('function');
  });
});
