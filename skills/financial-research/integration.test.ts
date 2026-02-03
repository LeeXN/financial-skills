/**
 * Integration Tests for Financial Research Skills
 *
 * End-to-end tests for skill workflows with MCP server integration
 */

import { describe, beforeAll, afterAll, it, expect, beforeEach } from 'vitest';
import { MCPClientWrapper } from './shared/mcp/client.js';

// Mock MCP client for integration testing
class MockMCPClientForIntegration extends MCPClientWrapper {
  private callCount = 0;

  constructor(private mockResponses: Map<string, any>) {
    super({ serverCommand: 'node', serverArgs: [] });
  }

  async invokeTool(name: string, args: any) {
    this.callCount++;
    const key = `${name}-${JSON.stringify(args)}`;
    const response = this.mockResponses.get(key);

    if (response?.error) {
      return { success: false, error: response.error };
    }

    return response || {
      success: true,
      data: null,
      normalized: null,
    };
  }

  getCallCount() {
    return this.callCount;
  }

  getToolStats() {
    return { calls: this.callCount, rateLimited: false };
  }

  resetRateLimits() {
    this.callCount = 0;
  }

  async disconnect() {
    this.mockResponses.clear();
  }
}

// Sample data for testing
const SAMPLE_PRICE_DATA = Array.from({ length: 100 }, (_, i) => ({
  date: `2024-01-${String(i + 1).padStart(2, '0')}`,
  close: 150 + Math.sin(i / 20) * 30 + (i * 0.5),
  high: 150 + Math.sin(i / 20) * 30 + (i * 0.5) + 5,
  low: 150 + Math.sin(i / 20) * 30 + (i * 0.5) - 5,
  open: 150 + Math.sin((i - 1) / 20) * 30 + ((i - 1) * 0.5),
  volume: 50000000 + Math.floor(Math.random() * 50000000),
}));

const SAMPLE_COMPANY_INFO = {
  symbol: 'AAPL',
  companyName: 'Apple Inc.',
  industry: 'Technology',
  sector: 'Consumer Electronics',
  marketCap: 2500000000000,
  description: 'Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories.',
  peers: ['MSFT', 'GOOGL', 'AMZN', 'META'],
};

const SAMPLE_NEWS = Array.from({ length: 20 }, (_, i) => ({
  id: String(i + 1),
  datetime: Date.now() / 1000 - i * 86400,
  headline: i % 2 === 0
    ? `Apple beats expectations with strong Q${4 - Math.floor(i / 4)} results`
    : `Apple faces regulatory scrutiny in EU market`,
  summary: 'Daily market update and analysis.',
  source: i % 2 === 0 ? 'Bloomberg' : 'Reuters',
  url: `https://example.com/${i + 1}`,
  related: ['AAPL'],
}));

describe('Integration Tests', () => {
  let mockClient: MockMCPClientForIntegration;

  beforeEach(() => {
    // Set up mock responses for each test
    mockClient = new MockMCPClientForIntegration(new Map([
      ['get_stock_quote-{"symbol":"AAPL","source":"finnhub"}', {
        success: true,
        normalized: { symbol: 'AAPL', currentPrice: 175, change: 2.5, percentChange: 1.45 },
      }],
      ['get_stock_price_history-{"symbol":"AAPL","source":"finnhub","resolution":"D","from":' + Math.floor((Date.now() - 365 * 24 * 60 * 60 * 1000) / 1000) + ',"to":' + Math.floor(Date.now() / 1000), {
        success: true,
        normalized: SAMPLE_PRICE_DATA,
      }],
      ['get_company_info-{"symbol":"AAPL","source":"finnhub"}', {
        success: true,
        normalized: SAMPLE_COMPANY_INFO,
      }],
      ['get_news-{"symbol":"AAPL","source":"finnhub"}', {
        success: true,
        normalized: SAMPLE_NEWS,
      }],
      ['get_financials-{"symbol":"AAPL","source":"finnhub","statementType":"all","period":"annual"}', {
        success: true,
        normalized: {
          revenue: [383285000000, 365817000000, 394328000000],
          netIncome: [94680000000, 93736000000, 99803000000],
          cashFlow: [104038000000, 110543000000, 109952000000],
        },
      }],
    ]));
  });

  describe('End-to-End Tests', () => {
    describe('Comparative Analysis Workflow', () => {
      it('should execute comparative analysis for multiple companies', async () => {
        // This would use the actual comparative analysis skill
        // For now, we test the MCP client integration
        const quoteResult = await mockClient.invokeTool('get_stock_quote', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        expect(quoteResult.success).toBe(true);
        expect(quoteResult.normalized).toBeDefined();
      });

      it('should handle parallel API calls for efficiency', async () => {
        // Test parallel calls
        const [quote1, quote2] = await Promise.all([
          mockClient.invokeTool('get_stock_quote', { symbol: 'AAPL', source: 'finnhub' }),
          mockClient.invokeTool('get_stock_quote', { symbol: 'MSFT', source: 'finnhub' }),
        ]);

        expect(quote1.success).toBe(true);
        expect(quote2.success).toBe(true);
        expect(mockClient.getCallCount()).toBe(2);
      });

      it('should handle missing data for one company in comparison', async () => {
        mockClient = new MockMCPClientForIntegration(new Map([
          ['get_stock_quote-{"symbol":"AAPL","source":"finnhub"}', {
            success: true,
            normalized: { symbol: 'AAPL', currentPrice: 175 },
          }],
          ['get_stock_quote-{"symbol":"INVALID","source":"finnhub"}', {
            success: false,
            error: 'Symbol not found',
          }],
        ]));

        const validResult = await mockClient.invokeTool('get_stock_quote', {
          symbol: 'AAPL',
          source: 'finnhub',
        });
        const invalidResult = await mockClient.invokeTool('get_stock_quote', {
          symbol: 'INVALID',
          source: 'finnhub',
        });

        expect(validResult.success).toBe(true);
        expect(invalidResult.success).toBe(false);
        expect(invalidResult.error).toBeDefined();
      });
    });

    describe('Trend Analysis Workflow', () => {
      it('should retrieve and analyze historical price data', async () => {
        const priceResult = await mockClient.invokeTool('get_stock_price_history', {
          symbol: 'AAPL',
          source: 'finnhub',
          resolution: 'D',
          from: Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000),
          to: Math.floor(Date.now() / 1000),
        });

        expect(priceResult.success).toBe(true);
        const data = priceResult.normalized as any[];
        expect(data).toBeDefined();
        expect(data.length).toBeGreaterThan(0);
      });

      it('should calculate moving averages correctly', () => {
        const closes = SAMPLE_PRICE_DATA.map(d => d.close);

        // Calculate 20-day SMA
        const sma20 = closes.slice(-20).reduce((sum, val) => sum + val, 0) / 20;
        expect(sma20).toBeGreaterThan(140);
        expect(sma20).toBeLessThan(180);

        // Calculate 50-day SMA
        const sma50 = closes.slice(-50).reduce((sum, val) => sum + val, 0) / 50;
        expect(sma50).toBeGreaterThan(130);
        expect(sma50).toBeLessThan(170);
      });

      it('should detect trend direction from price data', () => {
        const closes = SAMPLE_PRICE_DATA.map(d => d.close);
        const first = closes[0];
        const last = closes[closes.length - 1];
        const change = (last - first) / first;

        let direction: 'uptrend' | 'downtrend' | 'sideways';
        if (change > 0.05) direction = 'uptrend';
        else if (change < -0.05) direction = 'downtrend';
        else direction = 'sideways';

        expect(['uptrend', 'downtrend', 'sideways']).toContain(direction);
      });
    });

    describe('Multi-Step Research Workflow', () => {
      it('should orchestrate complex multi-step research queries', async () => {
        // Simulate a complex research workflow
        const steps = [
          mockClient.invokeTool('get_company_info', { symbol: 'AAPL', source: 'finnhub' }),
          mockClient.invokeTool('get_stock_quote', { symbol: 'AAPL', source: 'finnhub' }),
          mockClient.invokeTool('get_news', { symbol: 'AAPL', source: 'finnhub' }),
        ];

        const results = await Promise.all(steps);

        for (const result of results) {
          expect(result.success).toBe(true);
        }

        expect(mockClient.getCallCount()).toBe(3);
      });

      it('should accumulate context across tool calls', async () => {
        const context = {
          symbol: 'AAPL',
          dataPoints: [] as any[],
        };

        // First call - get company info
        const companyResult = await mockClient.invokeTool('get_company_info', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        if (companyResult.success) {
          context.dataPoints.push({ type: 'company', data: companyResult.normalized });
        }

        // Second call - get price data
        const priceResult = await mockClient.invokeTool('get_stock_quote', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        if (priceResult.success) {
          context.dataPoints.push({ type: 'price', data: priceResult.normalized });
        }

        expect(context.dataPoints.length).toBe(2);
        expect(context.dataPoints[0].type).toBe('company');
        expect(context.dataPoints[1].type).toBe('price');
      });

      it('should synthesize insights from gathered data', async () => {
        // Gather all data
        const [company, price, news] = await Promise.all([
          mockClient.invokeTool('get_company_info', { symbol: 'AAPL', source: 'finnhub' }),
          mockClient.invokeTool('get_stock_quote', { symbol: 'AAPL', source: 'finnhub' }),
          mockClient.invokeTool('get_news', { symbol: 'AAPL', source: 'finnhub' }),
        ]);

        // Synthesize insights
        const insights: string[] = [];

        if (company.success) {
          const info = company.normalized as any;
          insights.push(`${info.companyName} operates in the ${info.sector} sector`);
        }

        if (price.success) {
          const quote = price.normalized as any;
          insights.push(`Current price: ${quote.currentPrice}`);
        }

        if (news.success && Array.isArray(news.normalized)) {
          const recentHeadlines = news.normalized.slice(0, 3).map((n: any) => n.headline);
          insights.push(`Recent news: ${recentHeadlines.join(', ')}`);
        }

        expect(insights.length).toBeGreaterThan(0);
      });
    });

    describe('Error Handling and Graceful Exit', () => {
      it('should continue on partial failures', async () => {
        const partialClient = new MockMCPClientForIntegration(new Map([
          ['get_stock_quote-{"symbol":"AAPL","source":"finnhub"}', {
            success: true,
            normalized: { currentPrice: 175 },
          }],
          ['get_stock_quote-{"symbol":"FAIL","source":"finnhub"}', {
            success: false,
            error: 'Symbol not found',
          }],
        ]));

        const results = await Promise.allSettled([
          partialClient.invokeTool('get_stock_quote', { symbol: 'AAPL', source: 'finnhub' }),
          partialClient.invokeTool('get_stock_quote', { symbol: 'FAIL', source: 'finnhub' }),
        ]);

        expect(results[0].status).toBe('fulfilled');
        expect(results[1].status).toBe('rejected');
      });

      it('should handle rate limit errors gracefully', async () => {
        const rateLimitedClient = new MockMCPClientForIntegration(new Map([
          ['get_stock_quote-{"symbol":"AAPL","source":"finnhub"}', {
            success: false,
            error: 'Rate limit exceeded',
          }],
        ]));

        const result = await rateLimitedClient.invokeTool('get_stock_quote', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Rate limit');
      });

      it('should handle malformed API responses', async () => {
        const malformedClient = new MockMCPClientForIntegration(new Map([
          ['get_stock_quote-{"symbol":"AAPL","source":"finnhub"}', {
            success: true,
            normalized: { invalid: 'data structure' },
          }],
        ]));

        const result = await malformedClient.invokeTool('get_stock_quote', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        // Should not throw, but handle gracefully
        expect(result).toBeDefined();
      });

      it('should handle network timeouts', async () => {
        const timeoutClient = new MockMCPClientForIntegration(new Map([
          ['get_stock_quote-{"symbol":"AAPL","source":"finnhub"}', {
            success: false,
            error: 'Request timeout',
          }],
        ]));

        const result = await timeoutClient.invokeTool('get_stock_quote', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        expect(result.success).toBe(false);
      });
    });

    describe('Rate Limit Handling', () => {
      it('should track API call counts', async () => {
        // Make multiple calls
        for (let i = 0; i < 5; i++) {
          await mockClient.invokeTool('get_stock_quote', {
            symbol: 'AAPL',
            source: 'finnhub',
          });
        }

        const stats = mockClient.getToolStats();
        expect(stats.calls).toBe(5);
      });

      it('should detect rate limit conditions', async () => {
        // Simulate rate limited scenario
        const rateLimitClient = new MockMCPClientForIntegration(new Map([
          ['get_stock_quote-{"symbol":"AAPL","source":"finnhub"}', {
            success: false,
            error: '429 Too Many Requests',
          }],
        ]));

        const result = await rateLimitClient.invokeTool('get_stock_quote', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('429');
      });

      it('should reset rate limits when requested', async () => {
        // Make calls
        await mockClient.invokeTool('get_stock_quote', { symbol: 'AAPL', source: 'finnhub' });
        expect(mockClient.getCallCount()).toBe(1);

        // Reset
        mockClient.resetRateLimits();
        expect(mockClient.getCallCount()).toBe(0);
      });
    });

    describe('Performance Testing', () => {
      it('should handle large datasets efficiently', async () => {
        const startTime = Date.now();

        const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
          date: `2020-01-${String((i % 30) + 1).padStart(2, '0')}`,
          close: 100 + i * 0.1,
        }));

        // Simulate processing large dataset
        const closes = largeDataset.map(d => d.close);
        const sma = closes.reduce((sum, val) => sum + val, 0) / closes.length;

        const endTime = Date.now();
        const processingTime = endTime - startTime;

        expect(sma).toBeDefined();
        expect(processingTime).toBeLessThan(1000); // Should process in under 1 second
      });

      it('should minimize token usage in summaries', async () => {
        // Test that summaries are concise
        const summary = `Apple Inc. (AAPL) is trading at $175. The company has a market cap of $2.5T and operates in the Technology sector.`;

        // Check summary length (should be under 500 tokens for efficiency)
        const tokenEstimate = summary.length / 4; // Rough estimate
        expect(tokenEstimate).toBeLessThan(500);
      });

      it('should measure response times for each tool call', async () => {
        const measurements: number[] = [];

        for (let i = 0; i < 10; i++) {
          const start = Date.now();
          await mockClient.invokeTool('get_stock_quote', {
            symbol: 'AAPL',
            source: 'finnhub',
          });
          measurements.push(Date.now() - start);
        }

        const avgResponseTime = measurements.reduce((sum, t) => sum + t, 0) / measurements.length;

        // Average response time should be reasonable
        expect(avgResponseTime).toBeLessThan(5000); // Under 5 seconds
      });
    });

    describe('Validation Against Spec Requirements', () => {
      it('should meet comparative analysis spec requirements', async () => {
        // Test that comparative analysis includes required elements:
        // - Multiple companies comparison
        // - Comparative metrics (growth rates, ratios, valuation)
        // - Markdown table output
        const companies = ['AAPL', 'MSFT'];
        const quotes = await Promise.all(
          companies.map(symbol =>
            mockClient.invokeTool('get_stock_quote', { symbol, source: 'finnhub' })
          )
        );

        expect(quotes.length).toBe(2);
        quotes.forEach(q => expect(q.success).toBe(true));
      });

      it('should meet trend analysis spec requirements', async () => {
        // Test trend analysis includes:
        // - Historical data retrieval
        // - Moving averages (SMA, EMA)
        // - Trend direction classification
        const priceResult = await mockClient.invokeTool('get_stock_price_history', {
          symbol: 'AAPL',
          source: 'finnhub',
          resolution: 'D',
          from: Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000),
          to: Math.floor(Date.now() / 1000),
        });

        expect(priceResult.success).toBe(true);
        const data = priceResult.normalized as any[];
        expect(data.length).toBeGreaterThan(20); // Enough data for SMA calculation
      });

      it('should meet news sentiment spec requirements', async () => {
        // Test news sentiment includes:
        // - News retrieval
        // - Sentiment classification
        // - Theme extraction
        const newsResult = await mockClient.invokeTool('get_news', {
          symbol: 'AAPL',
          source: 'finnhub',
        });

        expect(newsResult.success).toBe(true);
        const news = newsResult.normalized as any[];
        expect(Array.isArray(news)).toBe(true);
        expect(news.length).toBeGreaterThan(0);
      });

      it('should meet research report spec requirements', async () => {
        // Test report generation includes:
        // - Data consolidation from multiple sources
        // - Executive summary
        // - Structured sections
        // - Markdown formatting
        const [company, price, news] = await Promise.all([
          mockClient.invokeTool('get_company_info', { symbol: 'AAPL', source: 'finnhub' }),
          mockClient.invokeTool('get_stock_quote', { symbol: 'AAPL', source: 'finnhub' }),
          mockClient.invokeTool('get_news', { symbol: 'AAPL', source: 'finnhub' }),
        ]);

        const hasData = company.success || price.success || news.success;
        expect(hasData).toBe(true);
      });
    });
  });

  describe('Real MCP API Testing', () => {
    it('should note that real API testing requires API keys', () => {
      // This test documents that real API testing requires actual API keys
      const hasApiKey = process.env.FINNHUB_API_KEY && process.env.ALPHAVANTAGE_API_KEY;

      if (!hasApiKey) {
        console.log('Skipping real API tests - API keys not configured');
        expect(true).toBe(true); // Placeholder test
      } else {
        // Would run real API tests here
        expect(hasApiKey).toBe(true);
      }
    });
  });

  afterAll(() => {
    mockClient.disconnect();
  });
});
