---
name: comparative-analysis
description: Automated comparison of multiple companies across financial metrics
version: 1.0.0
license: MIT
metadata:
  author: Financial Skills Team
  category: financial-research
  compatibility:
    opencode: ^1.0.0
    claude-code: ^1.0.0
  dependencies:
    mcp: financial-data-mcp
    sdk: @modelcontextprotocol/sdk
  capabilities:
    - Multi-company data retrieval with parallel API calls
    - Comparative metric calculation (growth rates, ratios, valuation)
    - Time period normalization and fiscal calendar alignment
    - Markdown table generation with best performer highlighting
    - Narrative comparison generation
    - Visual presentation of results
---

This skill performs comparative financial analysis of multiple companies, including:

1. **Data Retrieval**: Fetches financial data for multiple companies in parallel
2. **Metric Calculation**: Computes growth rates, ratios, valuation metrics
3. **Normalization**: Aligns time periods and fiscal calendars for fair comparison
4. **Presentation**: Generates markdown tables and narrative insights
5. **Highlighting**: Identifies best and worst performers in each metric

## Usage

Provide companies and metrics to compare:

```
// Basic comparison
"Compare AAPL, MSFT, and GOOGL over last 4 quarters"

// Specific metrics
"Compare revenue growth between Amazon and Apple over 2 years"

// Valuation comparison
"Compare P/E ratios for FAANG stocks"
```

## Features

**Supported Comparisons:**
- Revenue and earnings growth (YoY, QoQ, CAGR)
- Profitability metrics (margin, ROE, ROA)
- Valuation ratios (P/E, P/B, EV/EBITDA)
- Stock performance (total return, volatility)
- Market cap and share data
- Balance sheet strength
- Cash flow metrics

**Time Periods:**
- Last N quarters (specify number)
- Last N years
- Custom date ranges
- Fiscal year alignment

## Integration

Uses `financial-data-mcp` MCP server tools:
- get_stock_quote: Current prices and changes
- get_stock_price_history: Historical price data
- get_financials: Financial statements
- get_company_info: Company overview and metrics

## Output

Returns formatted comparison including:
1. Summary table with all companies and metrics
2. Highlighted best performers in each category
3. Narrative analysis of key findings
4. Charts/graphs (ASCII or markdown tables)
5. Statistical significance indicators where applicable
