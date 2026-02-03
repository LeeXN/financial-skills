import { MCPClientWrapper, MCPToolResult } from '@shared/mcp/client.js';
import { Scratchpad } from '@shared/context/scratchpad.js';
import { estimateTokens, checkBudget, shouldCompact, getRemainingBudget } from '@shared/context/token-budget.js';
import { info, error } from '@shared/utils/logger.js';
import { isRetryableError } from '@shared/mcp/error-handler.js';

export interface ResearchPlan {
  steps: ResearchStep[];
  estimatedTokens: number;
  description: string;
}

export interface ResearchStep {
  toolName: string;
  args: Record<string, unknown>;
  description: string;
  priority: number;
}

export interface ResearchResult {
  plan: ResearchPlan;
  executionLog: string[];
  insights: string;
  completedSteps: number;
  totalSteps: number;
  dataQuality: 'complete' | 'partial' | 'insufficient';
}

export class FinancialResearchOrchestrator {
  private scratchpad: Scratchpad;
  private mcpClient: MCPClientWrapper;
  private currentTokens = 0;

  constructor(mcpClient: MCPClientWrapper) {
    this.mcpClient = mcpClient;
    this.scratchpad = new Scratchpad();
  }

  async research(query: string): Promise<ResearchResult> {
    info('Starting research', { query });

    const plan = this.planResearch(query);

    if (!checkBudget(plan.estimatedTokens)) {
      error('Token budget exceeded before execution', { estimatedTokens: plan.estimatedTokens });
      return {
        plan,
        executionLog: [],
        insights: `Cannot execute research: requires ${plan.estimatedTokens} tokens but only ${getRemainingBudget(this.currentTokens)} available.`,
        completedSteps: 0,
        totalSteps: plan.steps.length,
        dataQuality: 'insufficient'
      };
    }

    const results: string[] = [];
    let completedSteps = 0;

    info('Executing plan', { steps: plan.steps.length });

    for (const step of plan.steps) {
      if (!checkBudget(this.currentTokens)) {
        info('Token budget reached, stopping execution', { completedSteps, totalSteps: plan.steps.length });
        break;
      }

      const stepResult = await this.executeStep(step);

      if (stepResult) {
        completedSteps++;
        results.push(stepResult);
      } else {
        results.push('Step failed - see execution log for details');
      }

      if (shouldCompact(this.currentTokens)) {
        await this.compactContext();
      }
    }

    const insights = this.synthesizeInsights(query, results);

    return {
      plan,
      executionLog: results,
      insights,
      completedSteps,
      totalSteps: plan.steps.length,
      dataQuality: this.assessDataQuality(completedSteps, plan.steps.length)
    };
  }

  private planResearch(query: string): ResearchPlan {
    info('Planning research', { query });

    const steps: ResearchStep[] = [];
    let estimatedTokens = estimateTokens(query);

    if (this.requiresComparativeAnalysis(query)) {
      steps.push(...this.planComparativeAnalysis(query));
      estimatedTokens += 5000;
    } else if (this.requiresTrendAnalysis(query)) {
      steps.push(...this.planTrendAnalysis(query));
      estimatedTokens += 4000;
    } else if (this.requiresSentimentAnalysis(query)) {
      steps.push(...this.planSentimentAnalysis(query));
      estimatedTokens += 3000;
    } else if (this.requiresGeneralResearch(query)) {
      steps.push(...this.planGeneralResearch(query));
      estimatedTokens += 4000;
    }

    return {
      steps,
      estimatedTokens,
      description: `Research plan for: ${query}`
    };
  }

  private requiresComparativeAnalysis(query: string): boolean {
    const comparativeKeywords = ['compare', 'versus', 'vs', 'against', 'better than', 'worse than', 'outperform'];
    return comparativeKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private requiresTrendAnalysis(query: string): boolean {
    const trendKeywords = ['trend', 'over time', 'historical', 'over the last', 'pattern', 'seasonal'];
    return trendKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private requiresSentimentAnalysis(query: string): boolean {
    const sentimentKeywords = ['sentiment', 'news', 'headlines', 'buzz', 'hype', 'concern', 'bullish', 'bearish'];
    return sentimentKeywords.some(keyword => query.toLowerCase().includes(keyword));
  }

  private requiresGeneralResearch(query: string): boolean {
    return !this.requiresComparativeAnalysis(query) &&
           !this.requiresTrendAnalysis(query) &&
           !this.requiresSentimentAnalysis(query);
  }

  private planComparativeAnalysis(query: string): ResearchStep[] {
    const companies = this.extractCompanySymbols(query);
    const steps: ResearchStep[] = [];

    for (const company of companies) {
      steps.push({
        toolName: 'get_stock_quote',
        args: { symbol: company, source: 'finnhub' },
        description: `Get current stock quote for ${company}`,
        priority: 1
      });

      steps.push({
        toolName: 'get_financials',
        args: { symbol: company, period: 'quarterly', statementType: 'all' },
        description: `Get quarterly financials for ${company}`,
        priority: 2
      });
    }

    if (companies.length === 2) {
      steps.push({
        toolName: 'get_stock_price_history',
        args: { symbol: companies[0], resolution: 'M', source: 'finnhub' },
        description: `Get monthly price history for ${companies[0]}`,
        priority: 3
      });

      steps.push({
        toolName: 'get_stock_price_history',
        args: { symbol: companies[1], resolution: 'M', source: 'finnhub' },
        description: `Get monthly price history for ${companies[1]}`,
        priority: 3
      });
    }

    return steps;
  }

  private planTrendAnalysis(query: string): ResearchStep[] {
    const company = this.extractCompanySymbols(query)[0] || 'AAPL';
    const steps: ResearchStep[] = [];

    steps.push({
      toolName: 'get_stock_price_history',
      args: { symbol: company, resolution: 'D', source: 'finnhub' },
      description: `Get daily price history for ${company}`,
      priority: 1
    });

    steps.push({
      toolName: 'get_financials',
      args: { symbol: company, period: 'annual', statementType: 'income' },
      description: `Get annual income statements for ${company}`,
      priority: 2
    });

    steps.push({
      toolName: 'get_technical_indicator',
      args: { symbol: company, indicator: 'SMA', interval: 'daily', timePeriod: '50', source: 'alphavantage' },
      description: `Get 50-day SMA for ${company}`,
      priority: 3
    });

    return steps;
  }

  private planSentimentAnalysis(query: string): ResearchStep[] {
    const company = this.extractCompanySymbols(query)[0] || 'AAPL';
    const steps: ResearchStep[] = [];

    steps.push({
      toolName: 'get_news',
      args: { symbol: company, source: 'finnhub', category: 'general' },
      description: `Get recent news for ${company}`,
      priority: 1
    });

    steps.push({
      toolName: 'get_stock_quote',
      args: { symbol: company, source: 'finnhub' },
      description: `Get current stock quote for ${company}`,
      priority: 2
    });

    return steps;
  }

  private planGeneralResearch(query: string): ResearchStep[] {
    const company = this.extractCompanySymbols(query)[0] || 'AAPL';
    const steps: ResearchStep[] = [];

    steps.push({
      toolName: 'get_company_info',
      args: { symbol: company, source: 'finnhub' },
      description: `Get company overview for ${company}`,
      priority: 1
    });

    steps.push({
      toolName: 'get_financials',
      args: { symbol: company, period: 'annual', statementType: 'all' },
      description: `Get annual financials for ${company}`,
      priority: 2
    });

    steps.push({
      toolName: 'get_stock_quote',
      args: { symbol: company, source: 'finnhub' },
      description: `Get current stock quote for ${company}`,
      priority: 3
    });

    return steps;
  }

  private extractCompanySymbols(query: string): string[] {
    const symbolPattern = /\b[A-Z]{2,5}\b/g;
    const matches = query.match(symbolPattern);
    return matches ? [...new Set(matches)] : [];
  }

  private async executeStep(step: ResearchStep): Promise<string | null> {
    info('Executing step', { tool: step.toolName, args: step.args });

    this.scratchpad.addToolCall(step.toolName, step.args, null);

    const result = await this.mcpClient.invokeTool(step.toolName, step.args);
    const tokensUsed = estimateTokens(JSON.stringify(result));

    this.currentTokens += tokensUsed;

    if (!result.success) {
      const errorMsg = result.error || 'Unknown error';
      error('Tool execution failed', { tool: step.toolName, error: errorMsg });
      this.scratchpad.addToolError(step.toolName, step.args, errorMsg);

      if (!isRetryableError(errorMsg)) {
        return `Failed: ${step.description} - ${errorMsg}`;
      }

      return `Warning: ${step.description} - ${errorMsg}`;
    }

    this.scratchpad.addToolCall(step.toolName, step.args, result.data);
    info('Step completed', { tool: step.toolName, tokensUsed });

    return `Success: ${step.description}`;
  }

  private async compactContext(): Promise<void> {
    info('Compacting context', { currentTokens: this.currentTokens });

    const toolCalls = this.scratchpad.getToolCalls();
    const olderCalls = toolCalls.slice(0, -3);

    for (const call of olderCalls) {
      if (!call.summary) {
        const summary = this.generateSummary(call);
        this.scratchpad.addSummary(summary);
        this.currentTokens -= estimateTokens(JSON.stringify(call.result));
      }
    }
  }

  private generateSummary(call: any): string {
    if (!call.result) {
      return `${call.toolName}: No data`;
    }

    const result = call.result as Record<string, unknown>;

    if (typeof result === 'string') {
      return `${call.toolName}: ${result}`;
    }

    const keys = Object.keys(result);
    if (keys.length === 0) {
      return `${call.toolName}: Empty result`;
    }

    return `${call.toolName}: ${keys.slice(0, 5).join(', ')}...`;
  }

  private synthesizeInsights(query: string, executionLog: string[]): string {
    const successfulSteps = executionLog.filter(log => log?.includes('Success'));

    if (successfulSteps.length === 0) {
      return 'Unable to gather any data for this query. Please check your API key configuration or try a different query.';
    }

    let insights = `## Research Results\n\nQuery: ${query}\n\n`;

    insights += `Completed Steps: ${successfulSteps.length}\n\n`;

    const recentLogs = executionLog.slice(-5);
    insights += `Recent Activity:\n${recentLogs.join('\n')}\n\n`;

    insights += `## Key Findings\n\n`;
    insights += 'Data has been gathered and is available for analysis. ';
    insights += 'Use the comparative-analysis, trend-analysis, or sentiment-analysis skills ';
    insights += 'for detailed insights on the collected data.\n';

    return insights;
  }

  private assessDataQuality(completedSteps: number, totalSteps: number): 'complete' | 'partial' | 'insufficient' {
    if (completedSteps === totalSteps) {
      return 'complete';
    }

    if (completedSteps >= totalSteps * 0.5) {
      return 'partial';
    }

    return 'insufficient';
  }
}
