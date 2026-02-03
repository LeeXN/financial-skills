/**
 * News Sentiment Analysis Skill Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NewsSentimentAnalyzer, NewsSentimentInput } from './index.js';
import { MCPClientWrapper } from '../../shared/mcp/client.js';

// Mock MCP client for testing
class MockMCPClient extends MCPClientWrapper {
  constructor(private mockData: any) {
    super({ serverCommand: 'node', serverArgs: [] });
  }

  async invokeTool(name: string, args: any) {
    if (name === 'get_news') {
      return {
        success: true,
        normalized: this.mockData.news || [],
      };
    }
    if (name === 'get_stock_price_history') {
      return {
        success: true,
        normalized: this.mockData.priceHistory || [],
      };
    }
    return { success: false, error: 'Unknown tool' };
  }

  async disconnect() {}
}

describe('NewsSentimentAnalyzer', () => {
  let analyzer: NewsSentimentAnalyzer;
  let mockClient: MockMCPClient;

  // Sample news data for testing
  const sampleNewsData = [
    {
      id: '1',
      datetime: Date.now() / 1000 - 86400, // 1 day ago
      headline: 'Apple beats earnings estimates, stock surges',
      summary: 'Apple reported strong quarterly earnings beating analyst expectations.',
      source: 'Reuters',
      url: 'https://example.com/1',
      related: ['AAPL'],
    },
    {
      id: '2',
      datetime: Date.now() / 1000 - 172800, // 2 days ago
      headline: 'Apple launches new product line',
      summary: 'The tech giant unveiled its latest product innovation.',
      source: 'Bloomberg',
      url: 'https://example.com/2',
      related: ['AAPL'],
    },
    {
      id: '3',
      datetime: Date.now() / 1000 - 259200, // 3 days ago
      headline: 'Apple faces regulatory probe in Europe',
      summary: 'EU regulators investigate potential antitrust violations.',
      source: 'WSJ',
      url: 'https://example.com/3',
      related: ['AAPL'],
    },
    {
      id: '4',
      datetime: Date.now() / 1000 - 345600, // 4 days ago
      headline: 'Apple announces dividend increase',
      summary: 'Board approves 10% dividend hike for shareholders.',
      source: 'CNBC',
      url: 'https://example.com/4',
      related: ['AAPL'],
    },
    {
      id: '5',
      datetime: Date.now() / 1000 - 432000, // 5 days ago
      headline: 'Apple stock dips on market concerns',
      summary: 'Shares declined as broader market sold off.',
      source: 'Reuters',
      url: 'https://example.com/5',
      related: ['AAPL'],
    },
    // Add more articles
    ...Array.from({ length: 15 }, (_, i) => ({
      id: String(i + 6),
      datetime: Date.now() / 1000 - (i + 6) * 86400,
      headline: i % 2 === 0 ? `Apple shows strong growth` : `Apple faces some challenges`,
      summary: 'Daily market update.',
      source: 'Bloomberg',
      url: `https://example.com/${i + 6}`,
      related: ['AAPL'],
    })),
  ];

  beforeEach(() => {
    mockClient = new MockMCPClient({ news: sampleNewsData });
    analyzer = new NewsSentimentAnalyzer(mockClient);
  });

  describe('Article Analysis', () => {
    it('should classify positive headlines correctly', () => {
      const positiveArticle = sampleNewsData[0];
      const result = analyzer['analyzeArticle'](positiveArticle);

      expect(result.sentiment).toBe('positive');
      expect(result.score).toBeGreaterThan(0);
    });

    it('should classify negative headlines correctly', () => {
      const negativeArticle = sampleNewsData[2];
      const result = analyzer['analyzeArticle'](negativeArticle);

      expect(result.sentiment).toBe('negative');
      expect(result.score).toBeLessThan(0);
    });

    it('should extract themes from articles', () => {
      const result = analyzer['analyzeArticle'](sampleNewsData[0]);

      expect(result.themes).toBeDefined();
      expect(Array.isArray(result.themes)).toBe(true);
    });
  });

  describe('Sentiment Calculation', () => {
    it('should calculate overall sentiment from multiple articles', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
      });

      expect(result.overallSentiment).toBeDefined();
      expect(typeof result.overallSentiment).toBe('number');
      expect(result.overallSentiment).toBeGreaterThanOrEqual(-1);
      expect(result.overallSentiment).toBeLessThanOrEqual(1);
    });

    it('should calculate sentiment distribution correctly', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
      });

      expect(result.distribution).toBeDefined();
      const total = result.distribution.positive + result.distribution.negative + result.distribution.neutral;
      expect(total).toBe(100); // Should equal 100%
    });
  });

  describe('Trend Analysis', () => {
    it('should detect improving sentiment trend', async () => {
      // Create data with improving sentiment (more positive recent articles)
      const improvingNews = [
        ...sampleNewsData.filter((_, i) => i < 3), // Keep recent positives
        ...Array.from({ length: 10 }, (_, i) => ({
          id: String(i + 10),
          datetime: Date.now() / 1000 - (i + 7) * 86400,
          headline: 'Apple faces more challenges',
          summary: 'Negative news from earlier period.',
          source: 'WSJ',
          url: `https://example.com/${i + 10}`,
          related: ['AAPL'],
        })),
      ];

      mockClient = new MockMCPClient({ news: improvingNews });
      analyzer = new NewsSentimentAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 14,
      });

      expect(result.trend.direction).toBeDefined();
    });
  });

  describe('Theme Extraction', () => {
    it('should extract and rank themes by frequency', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
      });

      expect(result.themes).toBeDefined();
      expect(Array.isArray(result.themes)).toBe(true);
      expect(result.themes.length).toBeGreaterThan(0);

      // Themes should be sorted by count
      for (let i = 0; i < result.themes.length - 1; i++) {
        expect(result.themes[i].count).toBeGreaterThanOrEqual(result.themes[i + 1].count);
      }
    });
  });

  describe('Top Headlines', () => {
    it('should identify most positive headlines', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
      });

      expect(result.topHeadlines.positive).toBeDefined();
      expect(Array.isArray(result.topHeadlines.positive)).toBe(true);

      for (const headline of result.topHeadlines.positive) {
        expect(headline.score).toBeGreaterThan(0);
        expect(headline.headline).toBeDefined();
        expect(headline.date).toBeDefined();
      }
    });

    it('should identify most negative headlines', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
      });

      expect(result.topHeadlines.negative).toBeDefined();
      expect(Array.isArray(result.topHeadlines.negative)).toBe(true);

      for (const headline of result.topHeadlines.negative) {
        expect(headline.score).toBeLessThan(0);
        expect(headline.headline).toBeDefined();
        expect(headline.date).toBeDefined();
      }
    });
  });

  describe('Dashboard Generation', () => {
    it('should generate dashboard with all sections', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
      });

      expect(result.dashboard).toBeDefined();
      expect(typeof result.dashboard).toBe('string');
      expect(result.dashboard).toContain('SENTIMENT DASHBOARD');
      expect(result.dashboard).toContain('Overall Sentiment');
      expect(result.dashboard).toContain('Distribution');
    });
  });

  describe('Summary Generation', () => {
    it('should generate comprehensive summary', async () => {
      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
      });

      expect(result.summary).toBeDefined();
      expect(result.summary).toContain('News Sentiment Analysis');
      expect(result.summary).toContain('Overall Sentiment');
      expect(result.summary).toContain('Sentiment Distribution');
      expect(result.summary).toContain('Interpretation');
    });
  });

  describe('Insufficient Data Handling', () => {
    it('should handle case with insufficient articles', async () => {
      mockClient = new MockMCPClient({ news: [] });
      analyzer = new NewsSentimentAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'TEST',
        days: 7,
      });

      expect(result.articleCount).toBe(0);
      expect(result.classification).toBe('neutral');
      expect(result.dashboard).toContain('INSUFFICIENT DATA');
      expect(result.summary).toContain('Insufficient Data');
    });
  });

  describe('Price Correlation', () => {
    it('should attempt price correlation when enabled', async () => {
      const mockPriceData = Array.from({ length: 7 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        close: 150 + i * 2, // Rising price
      }));

      mockClient = new MockMCPClient({
        news: sampleNewsData,
        priceHistory: mockPriceData,
      });
      analyzer = new NewsSentimentAnalyzer(mockClient);

      const result = await analyzer.analyze({
        symbol: 'AAPL',
        days: 7,
        correlatePrice: true,
      });

      expect(result.priceCorrelation).toBeDefined();
    });
  });

  describe('Classification', () => {
    it('should classify strong_buy for very positive sentiment', () => {
      const classification = analyzer['classifySentiment'](0.6);
      expect(classification).toBe('strong_buy');
    });

    it('should classify strong_sell for very negative sentiment', () => {
      const classification = analyzer['classifySentiment'](-0.6);
      expect(classification).toBe('strong_sell');
    });

    it('should classify neutral for middle sentiment', () => {
      expect(analyzer['classifySentiment'](0)).toBe('neutral');
      expect(analyzer['classifySentiment'](0.05)).toBe('neutral');
      expect(analyzer['classifySentiment'](-0.05)).toBe('neutral');
    });
  });
});
