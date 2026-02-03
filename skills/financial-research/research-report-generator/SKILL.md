# Research Report Generator Skill

Generates comprehensive financial research reports by consolidating data from multiple sources with structured formatting and actionable insights.

## Usage

```bash
claude-code skill research-report --symbol "AAPL" --type "investment"
```

## Capabilities

- **Data Consolidation**: Aggregates data from price history, financials, news, and technical indicators
- **Executive Summary**: AI-generated concise summary of key findings
- **Structured Reports**: Organized sections (Overview, Analysis, Risks, Valuation, Recommendation)
- **Markdown Formatting**: Professional tables, headers, and formatting
- **Data Validation**: Quality checks and source attribution
- **Multiple Report Types**: Investment, Trading, Sector, and ESG reports
- **Actionable Insights**: Specific recommendations with risk levels

## Parameters

| Parameter | Required | Description | Examples |
|-----------|----------|-------------|----------|
| `symbol` | Yes | Stock ticker symbol | `AAPL`, `MSFT`, `GOOGL` |
| `type` | No | Report type (default: investment) | `investment`, `trading`, `sector`, `esg` |
| `period` | No | Analysis period (default: 1y) | `3m`, `6m`, `1y`, `3y` |
| `includeNews` | No | Include news analysis (default: true) | `true`, `false` |
| `includeTechnical` | No | Include technical analysis (default: true) | `true`, `false` |

## Examples

```bash
# Generate investment research report
claude-code skill research-report --symbol "AAPL" --type "investment"

# Generate short-term trading report
claude-code skill research-report --symbol "TSLA" --type "trading" --period "3m"

# Generate sector comparison report
claude-code skill research-report --symbol "MSFT" --type "sector"
```

## Report Structure

### Investment Research Report

```
# Investment Research Report: Apple Inc. (AAPL)

**Date:** January 15, 2025
**Analyst:** AI Research System
**Recommendation:** BUY
**Price Target:** $210.00

---

## Executive Summary

[2-3 paragraph summary of key findings, recommendation, and investment thesis]

---

## Company Overview

- Business Description
- Key Products/Services
- Market Position
- Competitive Landscape

---

## Financial Analysis

### Revenue & Earnings
- Revenue trends (3-year CAGR)
- Margin analysis
- Earnings quality

### Balance Sheet
- Cash position
- Debt levels
- Return on capital

### Cash Flow
- Operating cash flow
- Free cash flow
- Capital allocation

---

## Valuation

- P/E Ratio vs Peers
- DCF Analysis
- Comparable Companies
- 52-Week Range Context

---

## Growth Drivers

1. Product Cycle
2. Market Expansion
3. M&A Opportunities
4. Margin Expansion

---

## Risk Factors

1. Competition Risks
2. Regulatory Risks
3. Macro Risks
4. Company-Specific Risks

---

## Technical Analysis

- Trend Status
- Support/Resistance Levels
- Moving Average Analysis
- Momentum Indicators

---

## News & Sentiment

- Recent Headlines
- Sentiment Analysis
- Key Events

---

## Investment Recommendation

**Verdict:** BUY
**Confidence:** HIGH
**Time Horizon:** 12 months
**Entry Zone:** $175-$185
**Stop Loss:** $160
**Price Target:** $210

**Rationale:** [Detailed recommendation reasoning]

---

## Sources

- Finnhub API
- Alpha Vantage API
- Company Filings
- Market Data
```

## Report Types

### Investment Report
- **Time Horizon:** 12-24 months
- **Focus:** Fundamentals, valuation, long-term growth
- **Audience:** Long-term investors, portfolio managers
- **Key Metrics:** P/E, FCF, ROIC, CAGR

### Trading Report
- **Time Horizon:** Days to weeks
- **Focus:** Technical patterns, momentum, catalysts
- **Audience:** Active traders, hedge funds
- **Key Metrics:** RSI, MACD, Volume, Support/Resistance

### Sector Report
- **Scope:** Company within industry context
- **Focus:** Relative performance, sector trends
- **Audience:** Sector analysts, thematic investors
- **Key Metrics:** Relative strength, sector multiples

### ESG Report
- **Focus:** Environmental, Social, Governance
- **Metrics:** Carbon footprint, diversity, policies
- **Growing:** Sustainable investing demand

## Output

Reports are generated as Markdown with:
- Proper heading hierarchy (H1-H4)
- Data tables with alignment
- Bullet points for readability
- Bold for emphasis
- Code blocks for data
- Source attribution footnotes

## Notes

- Reports use real-time data from MCP APIs
- AI generates narrative sections from structured data
- All claims include source attribution
- Confidence levels indicated based on data quality
- Reports include specific actionability (entry/exit points, targets, stops)
