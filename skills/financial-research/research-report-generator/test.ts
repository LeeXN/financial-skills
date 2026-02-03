/**
 * Research Report Generator Skill Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ResearchReportGenerator, ReportInput } from './index.js';
import { MCPClientWrapper } from '../../shared/mcp/client.js';

// Mock MCP client for testing
class MockMCPClient extends MCPClientWrapper {
  constructor(private mockData: any) {
    super({ serverCommand: 'node', serverArgs: [] });
  }

  async invokeTool(name: string, args: any) {
    if (name === 'get_company_info') {
      return {
        success: true,
        normalized: this.mockData.companyInfo || {
          symbol: 'AAPL',
          companyName: 'Apple Inc.',
          industry: 'Technology',
          sector: 'Consumer Electronics',
          marketCap: 2500000000000,
          peers: ['MSFT', 'GOOGL', 'AMZN', 'META'],
        },
      };
    }
    if (name === 'get_stock_price_history') {
      return {
        success: true,
        normalized: this.mockData.priceHistory || this.generatePriceHistory(),
      };
    }
    if (name === 'get_financials') {
      return {
        success: true,
        normalized: this.mockData.financials || {},
      };
    }
    if (name === 'get_news') {
      return {
        success: true,
        normalized: this.mockData.news || [],
      };
    }
    if (name === 'get_technical_indicator') {
      return {
        success: true,
        normalized: this.mockData.technical || {},
      };
    }
    return { success: false, error: 'Unknown tool' };
  }

  async disconnect() {}

  private generatePriceHistory() {
    const basePrice = 175;
    return Array.from({ length: 252 }, (_, i) => ({
      date: `2024-${String(Math.floor(i / 21) + 1).padStart(2, '0')}-${String((i % 21) + 1).padStart(2, '0')}`,
      close: basePrice + Math.sin(i / 30) * 20 + (i * 0.1),
      high: basePrice + Math.sin(i / 30) * 20 + (i * 0.1) + 2,
      low: basePrice + Math.sin(i / 30) * 20 + (i * 0.1) - 2,
      open: basePrice + Math.sin((i - 1) / 30) * 20 + ((i - 1) * 0.1),
      volume: 50000000 + Math.floor(Math.random() * 50000000),
    }));
  }
}

describe('ResearchReportGenerator', () => {
  let generator: ResearchReportGenerator;
  let mockClient: MockMCPClient;

  // Sample news data
  const sampleNews = [
    {
      id: '1',
      datetime: Date.now() / 1000 - 86400,
      headline: 'Apple beats earnings expectations by 15%',
      summary: 'Strong quarterly results driven by iPhone and services growth.',
      source: 'Reuters',
      url: 'https://example.com/1',
      related: ['AAPL'],
    },
    {
      id: '2',
      datetime: Date.now() / 1000 - 172800,
      headline: 'Apple launches new AI-powered features',
      summary: 'New machine learning capabilities across product line.',
      source: 'Bloomberg',
      url: 'https://example.com/2',
      related: ['AAPL'],
    },
    {
      id: '3',
      datetime: Date.now() / 1000 - 259200,
      headline: 'EU regulators investigate Apple App Store practices',
      summary: 'Antitrust probe focuses on developer fees and competition.',
      source: 'WSJ',
      url: 'https://example.com/3',
      related: ['AAPL'],
    },
  ];

  beforeEach(() => {
    mockClient = new MockMCPClient({
      news: sampleNews,
    });
    generator = new ResearchReportGenerator(mockClient);
  });

  describe('Report Generation', () => {
    it('should generate investment report with all sections', async () => {
      const result = await generator.generate({
        symbol: 'AAPL',
        type: 'investment',
        period: '1y',
      });

      expect(result.symbol).toBe('AAPL');
      expect(result.type).toBe('investment');
      expect(result.markdown).toBeDefined();
      expect(result.markdown).toContain('# Investment Research Report');
      expect(result.markdown).toContain('## Executive Summary');
      expect(result.markdown).toContain('## Investment Recommendation');
      expect(result.markdown).toContain('## Sources');
    });

    it('should generate trading report with trading-specific sections', async () => {
      const result = await generator.generate({
        symbol: 'AAPL',
        type: 'trading',
        period: '3m',
      });

      expect(result.type).toBe('trading');
      expect(result.markdown).toContain('# Trading Alert');
      expect(result.markdown).toContain('## Trading Recommendation');
    });

    it('should generate sector report', async () => {
      const result = await generator.generate({
        symbol: 'AAPL',
        type: 'sector',
      });

      expect(result.type).toBe('sector');
      expect(result.markdown).toContain('# Sector Analysis');
    });

    it('should generate ESG report', async () => {
      const result = await generator.generate({
        symbol: 'AAPL',
        type: 'esg',
      });

      expect(result.type).toBe('esg');
      expect(result.markdown).toContain('# ESG Report');
    });
  });

  describe('Data Gathering', () => {
    it('should gather data from multiple sources', async () => {
      const data = await generator['gatherData']({
        symbol: 'AAPL',
        type: 'investment',
      });

      expect(data.symbol).toBe('AAPL');
      expect(data.companyInfo).toBeDefined();
      expect(data.priceData).toBeDefined();
      expect(Array.isArray(data.priceData)).toBe(true);
      expect(data.news).toBeDefined();
    });

    it('should handle missing data gracefully', async () => {
      mockClient = new MockMCPClient({});
      generator = new ResearchReportGenerator(mockClient);

      const data = await generator['gatherData']({
        symbol: 'TEST',
        type: 'investment',
        includeNews: false,
        includeTechnical: false,
      });

      expect(data.symbol).toBe('TEST');
      expect(data.priceData).toEqual([]);
    });
  });

  describe('Recommendation Logic', () => {
    it('should calculate BUY recommendation for uptrending stock', () => {
      const uptrendingData = {
        priceData: Array.from({ length: 30 }, (_, i) => ({
          close: 150 + i * 2, // Rising trend
        })),
      };

      const recommendation = generator['calculateRecommendation'](uptrendingData);

      expect(recommendation.verdict).toContain('BUY');
      expect(recommendation.confidence).toBeDefined();
      expect(recommendation.priceTarget).toBeDefined();
      expect(recommendation.entryZone).toBeDefined();
      expect(recommendation.stopLoss).toBeDefined();
    });

    it('should calculate SELL recommendation for downtrending stock', () => {
      const downtrendingData = {
        priceData: Array.from({ length: 30 }, (_, i) => ({
          close: 150 - i * 2, // Declining trend
        })),
      };

      const recommendation = generator['calculateRecommendation'](downtrendingData);

      expect(recommendation.verdict).toContain('SELL');
    });
  });

  describe('Section Generation', () => {
    it('should generate executive summary with key highlights', async () => {
      const summary = await generator['generateExecutiveSummary'](
        { symbol: 'AAPL', companyInfo: { companyName: 'Apple Inc.' } },
        'investment'
      );

      expect(summary).toContain('Executive Summary');
      expect(summary).toContain('Investment Thesis');
      expect(summary).toContain('Key Highlights');
    });

    it('should generate valuation section with metrics', () => {
      const valuation = generator['generateValuation']({
        symbol: 'AAPL',
        priceData: [{ close: 175 }],
      });

      expect(valuation).toContain('Current Valuation');
      expect(valuation).toContain('Valuation Metrics');
      expect(valuation).toContain('| P/E Ratio');
    });

    it('should generate technical analysis section', () => {
      const technical = generator['generateTechnicalAnalysisSection']({
        symbol: 'AAPL',
        priceData: [{ close: 175 }],
      });

      expect(technical).toContain('Trend Analysis');
      expect(technical).toContain('Support & Resistance');
    });

    it('should generate news sentiment section', () => {
      const news = generator['generateNewsSentimentSection']({
        symbol: 'AAPL',
        news: sampleNews,
      });

      expect(news).toContain('Recent Headlines');
      expect(news).toContain(sampleNews[0].headline);
      expect(news).toContain(sampleNews[1].headline);
    });
  });

  describe('Report Metadata', () => {
    it('should include recommendation metadata in result', async () => {
      const result = await generator.generate({
        symbol: 'AAPL',
        type: 'investment',
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata.recommendation).toBeDefined();
      expect(['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']).toContain(result.metadata.recommendation);
    });

    it('should include confidence level in metadata', async () => {
      const result = await generator.generate({
        symbol: 'AAPL',
        type: 'investment',
      });

      expect(['LOW', 'MEDIUM', 'HIGH']).toContain(result.metadata.confidence);
    });
  });

  describe('Markdown Formatting', () => {
    it('should use proper markdown formatting', async () => {
      const result = await generator.generate({
        symbol: 'AAPL',
        type: 'investment',
      });

      // Check for proper heading hierarchy
      expect(result.markdown).toMatch(/^# /m); // H1
      expect(result.markdown).toMatch(/^## /m); // H2
      expect(result.markdown).toMatch(/^### /m); // H3

      // Check for tables
      expect(result.markdown).toContain('|');

      // Check for bold text
      expect(result.markdown).toContain('**');

      // Check for lists
      expect(result.markdown).toContain('- ');
    });
  });

  describe('Data Validation', () => {
    it('should validate data and throw error for insufficient data', () => {
      expect(() =>
        generator['validateData']({ symbol: 'TEST' })
      ).toThrow();
    });

    it('should add warnings for missing optional data', () => {
      const data = {
        symbol: 'TEST',
        companyInfo: { companyName: 'Test Corp' },
        priceData: [],
      };

      generator['validateData'](data);

      expect((data as any).warnings).toBeDefined();
      expect((data as any).warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty news array', () => {
      const news = generator['generateNewsSentimentSection']({
        symbol: 'AAPL',
        news: [],
      });

      expect(news).toContain('not available');
    });

    it('should handle missing company info', () => {
      const overview = generator['generateCompanyOverview']({
        symbol: 'AAPL',
      });

      expect(overview).toBeDefined();
      // Should still generate something even without data
    });
  });
});
