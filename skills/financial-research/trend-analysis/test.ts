/**
 * Trend Analysis Skill Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TrendAnalyzer, TrendAnalysisInput } from './index.js';
import { MCPClientWrapper } from '../../shared/mcp/client.js';

// Mock MCP client for testing
class MockMCPClient extends MCPClientWrapper {
  constructor(private mockData: any) {
    super({ serverCommand: 'node', serverArgs: [] });
  }

  async invokeTool(name: string, args: any) {
    if (name === 'get_stock_price_history') {
      return {
        success: true,
        normalized: this.mockData.priceHistory || [],
      };
    }
    if (name === 'get_financials') {
      return {
        success: true,
        normalized: this.mockData.financials || [],
      };
    }
    return { success: false, error: 'Unknown tool' };
  }

  async disconnect() {}
}

describe('TrendAnalyzer', () => {
  let analyzer: TrendAnalyzer;
  let mockClient: MockMCPClient;

  // Sample price data for testing
  const samplePriceData = [
    { date: '2024-01-01', open: 150, high: 155, low: 148, close: 152, volume: 1000000 },
    { date: '2024-01-02', open: 152, high: 158, low: 151, close: 156, volume: 1200000 },
    { date: '2024-01-03', open: 156, high: 160, low: 154, close: 159, volume: 1100000 },
    { date: '2024-01-04', open: 159, high: 162, low: 157, close: 158, volume: 1300000 },
    { date: '2024-01-05', open: 158, high: 165, low: 157, close: 163, volume: 1400000 },
    { date: '2024-01-08', open: 163, high: 168, low: 161, close: 166, volume: 1500000 },
    { date: '2024-01-09', open: 166, high: 170, low: 164, close: 165, volume: 1600000 },
    { date: '2024-01-10', open: 165, high: 172, low: 163, close: 171, volume: 1700000 },
    { date: '2024-01-11', open: 171, high: 175, low: 169, close: 170, volume: 1800000 },
    { date: '2024-01-12', open: 170, high: 178, low: 168, close: 175, volume: 1900000 },
    // Add more data points for SMA/EMA calculations
    ...Array.from({ length: 50 }, (_, i) => ({
      date: `2024-02-${String(i + 1).padStart(2, '0')}`,
      open: 150 + i * 0.5,
      high: 155 + i * 0.5,
      low: 148 + i * 0.5,
      close: 152 + i * 0.5,
      volume: 1000000 + i * 10000,
    })),
  ];

  beforeEach(() => {
    mockClient = new MockMCPClient({
      priceHistory: samplePriceData,
      finances: [],
    });
    analyzer = new TrendAnalyzer(mockClient);
  });

  describe('Moving Averages', () => {
    it('should calculate SMA correctly', () => {
      const closes = samplePriceData.map(d => d.close);
      const sma20 = analyzer['calculateSMA'](closes, 20);
      expect(sma20).toBeGreaterThan(150);
      expect(sma20).toBeLessThan(180);
    });

    it('should calculate EMA correctly', () => {
      const closes = samplePriceData.map(d => d.close);
      const ema12 = analyzer['calculateEMA'](closes, 12);
      expect(ema12).toBeGreaterThan(150);
      expect(ema12).toBeLessThan(180);
    });
  });

  describe('Trend Direction', () => {
    it('should detect uptrend when price increases significantly', async () => {
      const uptrendData = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 102 + i,
        volume: 1000000,
      }));

      mockClient = new MockMCPClient({ priceHistory: uptrendData });
      analyzer = new TrendAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.trendDirection).toBe('uptrend');
      expect(result.trendStrength).toBeGreaterThan(0);
    });

    it('should detect downtrend when price decreases significantly', async () => {
      const downtrendData = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 200 - i,
        high: 205 - i,
        low: 195 - i,
        close: 198 - i,
        volume: 1000000,
      }));

      mockClient = new MockMCPClient({ priceHistory: downtrendData });
      analyzer = new TrendAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.trendDirection).toBe('downtrend');
      expect(result.trendStrength).toBeLessThan(0);
    });

    it('should detect sideways trend when price is stable', async () => {
      const sidewaysData = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        open: 150,
        high: 155,
        low: 145,
        close: 150 + (i % 3 - 1) * 2, // Small fluctuation
        volume: 1000000,
      }));

      mockClient = new MockMCPClient({ priceHistory: sidewaysData });
      analyzer = new TrendAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.trendDirection).toBe('sideways');
    });
  });

  describe('Support and Resistance', () => {
    it('should identify support levels from local minima', async () => {
      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.supportLevels).toBeDefined();
      expect(Array.isArray(result.supportLevels)).toBe(true);
    });

    it('should identify resistance levels from local maxima', async () => {
      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.resistanceLevels).toBeDefined();
      expect(Array.isArray(result.resistanceLevels)).toBe(true);
    });
  });

  describe('Inflection Points', () => {
    it('should detect peaks and troughs in price data', async () => {
      const volatileData = [
        { date: '2024-01-01', open: 100, high: 110, low: 95, close: 105, volume: 1000000 },
        { date: '2024-01-02', open: 105, high: 115, low: 100, close: 110, volume: 1200000 },
        { date: '2024-01-03', open: 110, high: 120, low: 105, close: 90, volume: 1500000 }, // Peak then drop
        { date: '2024-01-04', open: 90, high: 95, low: 85, close: 88, volume: 1300000 },
        { date: '2024-01-05', open: 88, high: 92, low: 82, close: 85, volume: 1400000 },
        { date: '2024-01-08', open: 85, high: 90, low: 80, close: 95, volume: 1600000 }, // Trough then rise
        { date: '2024-01-09', open: 95, high: 100, low: 90, close: 98, volume: 1500000 },
        { date: '2024-01-10', open: 98, high: 105, low: 95, close: 102, volume: 1400000 },
      ];

      mockClient = new MockMCPClient({ priceHistory: volatileData });
      analyzer = new TrendAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1w',
        indicator: 'price',
      });

      expect(result.inflectionPoints).toBeDefined();
      expect(result.inflectionPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Volatility', () => {
    it('should calculate standard deviation', async () => {
      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.volatility.standardDeviation).toBeDefined();
      expect(result.volatility.standardDeviation).toBeGreaterThan(0);
    });

    it('should calculate average true range', async () => {
      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.volatility.averageTrueRange).toBeDefined();
      expect(result.volatility.averageTrueRange).toBeGreaterThan(0);
    });
  });

  describe('ASCII Chart', () => {
    it('should generate ASCII chart for visualization', async () => {
      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1m',
        indicator: 'price',
      });

      expect(result.chart).toBeDefined();
      expect(typeof result.chart).toBe('string');
      expect(result.chart).toContain('▲'); // Should contain trend indicators
    });
  });

  describe('Seasonality', () => {
    it('should detect seasonal patterns when enabled', async () => {
      // Create data with seasonal pattern
      const seasonalData = Array.from({ length: 400 }, (_, i) => {
        const month = i % 12;
        const seasonalFactor = month < 3 || month > 10 ? 1.1 : 0.9; // Higher in winter
        return {
          date: `2023-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
          open: 100 * seasonalFactor,
          high: 105 * seasonalFactor,
          low: 95 * seasonalFactor,
          close: 102 * seasonalFactor,
          volume: 1000000,
        };
      });

      mockClient = new MockMCPClient({ priceHistory: seasonalData });
      analyzer = new TrendAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'TEST',
        period: '1y',
        indicator: 'price',
        detectSeasonality: true,
      });

      expect(result.seasonality).toBeDefined();
      expect(result.seasonality?.detected).toBeDefined();
    });
  });

  describe('Summary Generation', () => {
    it('should generate comprehensive summary', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        period: '3m',
        indicator: 'price',
      });

      expect(result.summary).toBeDefined();
      expect(result.summary).toContain('Trend Analysis Summary');
      expect(result.summary).toContain('Trend Direction');
      expect(result.summary).toContain('Trend Strength');
    });
  });
});
