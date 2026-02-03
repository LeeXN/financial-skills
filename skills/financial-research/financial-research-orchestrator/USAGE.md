# Financial Research Orchestrator Skill

## Overview

The Financial Research Orchestrator skill provides intelligent planning and execution of multi-step financial research workflows. It analyzes user queries, identifies required data points, executes tool calls through the MCP protocol, and synthesizes findings into actionable insights.

## Usage

### Basic Usage

```
// Example 1: Comparative analysis
"Compare Apple and Microsoft's performance over the last 3 quarters"

// Example 2: Trend analysis
"Analyze NVIDIA's revenue trend over the last year"

// Example 3: Sentiment analysis
"What's driving Tesla's stock sentiment this week?"

// Example 4: General research
"Provide a comprehensive overview of Microsoft's financial health"
```

### Query Patterns

The orchestrator automatically detects the type of research needed based on query keywords:

**Comparative Analysis:**
- Keywords: "compare", "versus", "vs", "against", "better than", "worse than", "outperform"
- Generates: Stock quotes, financial statements, price history for multiple companies

**Trend Analysis:**
- Keywords: "trend", "over time", "historical", "over the last", "pattern", "seasonal"
- Generates: Price history, financials, technical indicators for trend detection

**Sentiment Analysis:**
- Keywords: "sentiment", "news", "headlines", "buzz", "hype", "concern", "bullish", "bearish"
- Generates: News articles, stock quotes for sentiment correlation

**General Research:**
- Any other query
- Generates: Company info, financials, stock quotes for comprehensive overview

### Query Tips

1. **Be Specific**: Include company symbols (AAPL, MSFT) when possible for faster processing
2. **Specify Timeframes**: Add time ranges ("last 3 quarters", "over the last year") for more relevant results
3. **Use Natural Language**: Query in plain English, the skill handles interpretation
4. **Combine Requests**: Multiple research objectives can be combined in one query ("Compare AAPL and MSFT over 3 quarters")

### Output

The orchestrator returns a structured result:

```
{
  plan: {
    steps: [...],
    estimatedTokens: number,
    description: string
  },
  executionLog: [...],
  insights: string,
  completedSteps: number,
  totalSteps: number,
  dataQuality: 'complete' | 'partial' | 'insufficient'
}
```

### Data Quality Levels

- **complete**: All planned steps executed successfully
- **partial**: Some steps failed or were skipped, partial data available
- **insufficient**: Could not gather enough data for meaningful analysis

### Graceful Behavior

The orchestrator handles various edge cases:

- **Rate Limits**: Continues with available data, notifies user of limitations
- **API Errors**: Logs errors, continues to next step if possible
- **Token Budget**: Compacts context (summarizes older results) when approaching limit
- **Early Completion**: Stops early if sufficient data is gathered before all steps complete
- **No Recognizable Symbols**: Identifies missing company names and requests clarification

### Integration

This skill uses the MCP client wrapper to communicate with the `financial-data-mcp` server, which provides access to:

- Stock quotes (Finnhub, Alpha Vantage)
- Historical price data
- Financial statements (income, balance sheet, cash flow)
- Company information
- News articles (Finnhub)
- Technical indicators (Alpha Vantage)

### Advanced Usage

For more complex research, combine the orchestrator with specialized skills:

```
// Multi-step research flow
1. Use orchestrator to gather comprehensive data
2. Use comparative-analysis skill for detailed comparisons
3. Use trend-analysis skill for deeper trend insights
4. Use research-report-generator for final report
```

## Examples

### Example 1: Simple Stock Query

```
Query: "What's Apple's current stock price?"

Plan:
- get_stock_quote for AAPL
- get_company_info for AAPL

Execution:
- Called get_stock_quote: $178.50 (+1.2%)
- Called get_company_info: Apple Inc, Technology, $2.8T market cap

Insights:
Current stock quote and company overview for AAPL gathered successfully.
```

### Example 2: Comparative Analysis

```
Query: "Compare Amazon and Google's revenue over 4 quarters"

Plan:
- get_financials for AMZN (quarterly, income)
- get_financials for GOOGL (quarterly, income)
- get_stock_price_history for AMZN (monthly)
- get_stock_price_history for GOOGL (monthly)

Execution:
- Called get_financials for AMZN: Revenue $143.3B
- Called get_financials for GOOGL: Revenue $282.8B
- ...

Insights:
Comparative revenue analysis complete. Both companies showing growth.
```

### Example 3: Trend with Sentiment

```
Query: "Analyze Tesla's stock trend and news sentiment"

Plan:
- get_stock_price_history for TSLA (daily)
- get_news for TSLA (general)
- get_technical_indicator for TSLA (RSI)

Execution:
- Called get_stock_price_history: 252 data points
- Called get_news: 15 articles collected
- ...

Insights:
Trend analysis and sentiment correlation complete. Mixed sentiment detected.
```

## Troubleshooting

### Common Issues

**Issue**: "No data gathered"
- **Cause**: Company symbol not recognized or API errors
- **Solution**: Verify company symbol (check official ticker), ensure MCP server is running

**Issue**: "Partial results only"
- **Cause**: Rate limits hit, some tools failed
- **Solution**: Wait for rate limit reset, check API key configuration

**Issue**: "Context too large"
- **Cause**: Query requires too much data for token budget
- **Solution**: Break into smaller, more focused queries

### Rate Limit Handling

The orchestrator is aware of API rate limits:
- Tracks tool call counts per tool
- Provides warnings when approaching limits
- Continues with partial data rather than failing

### Error Recovery

When errors occur:
1. Logs error with full context (tool name, arguments)
2. Checks if error is retryable (timeout, rate limit)
3. Continues to next step if possible
4. Reports status in final insights

## Related Skills

For specialized analysis, use:
- **comparative-analysis**: Detailed multi-company comparisons
- **trend-analysis**: Advanced trend detection and forecasting
- **news-sentiment-analysis**: Sentiment analysis with price correlation
- **research-report-generator**: Comprehensive research reports
