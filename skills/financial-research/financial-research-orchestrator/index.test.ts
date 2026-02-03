import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FinancialResearchOrchestrator } from './index';
import { MCPClientWrapper } from '../../shared/mcp/client';

describe('FinancialResearchOrchestrator', () => {
  let orchestrator: FinancialResearchOrchestrator;
  let mockMCPClient: MCPClientWrapper;

  beforeEach(() => {
    mockMCPClient = {
      invokeTool: async () => ({
        success: true,
        data: { symbol: 'AAPL', currentPrice: 150, change: 2.5, percentChange: 1.69 },
        normalized: { symbol: 'AAPL', price: 150 }
      }),
      getToolStats: () => ({ calls: 1, rateLimited: false }),
      resetRateLimits: () => {},
      disconnect: async () => {}
    } as unknown as MCPClientWrapper;

    orchestrator = new FinancialResearchOrchestrator(mockMCPClient);
  });

  afterEach(() => {
  });

  describe('Query Analysis', () => {
    it('should identify comparative analysis queries', () => {
      const plan = (orchestrator as any).planResearch('Compare Apple and Microsoft performance');

      expect(plan.description).toContain('Compare');
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('should identify trend analysis queries', () => {
      const plan = (orchestrator as any).planResearch('Analyze NVIDIA revenue trend');

      expect(plan.description).toContain('trend');
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('should identify sentiment analysis queries', () => {
      const plan = (orchestrator as any).planResearch('What is Tesla stock sentiment');

      expect(plan.description).toContain('sentiment');
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('should extract company symbols from queries', () => {
      const result = (orchestrator as any).extractCompanySymbols('Compare AAPL vs MSFT');

      expect(result).toContain('AAPL');
      expect(result).toContain('MSFT');
    });
  });

  describe('Research Execution', () => {
    it('should complete all steps successfully', async () => {
      const result = await orchestrator.research('Get basic stock information for AAPL');

      expect(result.dataQuality).toBe('complete');
      expect(result.completedSteps).toBe(result.totalSteps);
      expect(result.executionLog.length).toBeGreaterThan(0);
    });

    it('should handle partial completion gracefully', async () => {
      const partialMCPClient = {
        invokeTool: async () => ({
          success: false,
          data: null,
          error: 'Rate limit exceeded'
        }),
        getToolStats: () => ({ calls: 1, rateLimited: true }),
        resetRateLimits: () => {},
        disconnect: async () => {}
      } as unknown as MCPClientWrapper;

      const partialOrchestrator = new FinancialResearchOrchestrator(partialMCPClient);
      const result = await partialOrchestrator.research('Get basic information for AAPL with rate limit');

      expect(result.dataQuality).toBe('partial');
      expect(result.completedSteps).toBeLessThan(result.totalSteps);
    });

    it('should generate insights even with insufficient data', async () => {
      const failedMCPClient = {
        invokeTool: async () => ({
          success: false,
          data: null,
          error: 'API unavailable'
        }),
        getToolStats: () => ({ calls: 1, rateLimited: false }),
        resetRateLimits: () => {},
        disconnect: async () => {}
      } as unknown as MCPClientWrapper;

      const failedOrchestrator = new FinancialResearchOrchestrator(failedMCPClient);
      const result = await failedOrchestrator.research('Get information for AAPL with API error');

      expect(result.dataQuality).toBe('insufficient');
      expect(result.insights).toContain('Unable to gather');
    });
  });

  describe('Context Management', () => {
    it('should track tool calls in scratchpad', async () => {
      await orchestrator.research('Get quote for AAPL');

      const scratchpad = (orchestrator as any).scratchpad;
      const toolCalls = scratchpad.getToolCalls();

      expect(toolCalls.length).toBeGreaterThan(0);
      expect(toolCalls[0].toolName).toBe('get_stock_quote');
    });

    it('should prevent duplicate tool calls', async () => {
      const plan = (orchestrator as any).planResearch('Get AAPL quote twice');

      const uniqueTools = new Set(plan.steps.map((step: any) => step.toolName));
      expect(uniqueTools.size).toBe(1);
    });
  });

  describe('Token Budget Management', () => {
    it('should track token usage', async () => {
      await orchestrator.research('Simple query with small response');

      expect((orchestrator as any).currentTokens).toBeGreaterThan(0);
    });

    it('should compact context when budget threshold reached', async () => {
      const largeQuery = 'Analyze 10 companies with all data points - this is a very long query that should trigger context compaction'.repeat(100);

      await orchestrator.research(largeQuery);

      expect((orchestrator as any).scratchpad.getSummaries().length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle queries with no recognizable company', async () => {
      const result = await orchestrator.research('Get financial data for XYZCOMPANY');

      expect(result.dataQuality).toBe('insufficient');
      expect(result.insights).toContain('No recognizable company symbols');
    });

    it('should handle empty queries', async () => {
      const result = await orchestrator.research('   ');

      expect(result.dataQuality).toBe('insufficient');
      expect(result.insights).toContain('Please provide');
    });

    it('should handle API rate limits', async () => {
      const rateLimitedClient = {
        invokeTool: async () => ({
          success: false,
          data: null,
          error: '429 Too Many Requests'
        }),
        getToolStats: () => ({ calls: 5, rateLimited: true }),
        resetRateLimits: () => {},
        disconnect: async () => {}
      } as unknown as MCPClientWrapper;

      const limitedOrchestrator = new FinancialResearchOrchestrator(rateLimitedClient);
      const result = await limitedOrchestrator.research('Get AAPL basic info with rate limit');

      expect(result.insights).toContain('Rate limit');
      expect(result.dataQuality).toBe('partial' || 'insufficient');
    });
  });
});
