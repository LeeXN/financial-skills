# Trend Analysis Skill

Analyzes historical price and financial data trends using statistical methods including moving averages, linear regression, and seasonality detection.

## Usage

```bash
claude-code skill trend-analysis --symbol "AAPL" --period "1y" --indicator "price"
```

## Capabilities

- **Moving Average Analysis**: Simple (SMA) and Exponential (EMA) moving averages for multiple periods
- **Linear Regression**: Trend line calculation with R-squared for trend strength
- **Trend Direction**: Automatic classification (uptrend, downtrend, sideways)
- **Inflection Points**: Detection of peaks and troughs with magnitude calculation
- **Seasonality Detection**: Identifies seasonal patterns with adjustment
- **Support/Resistance**: Finds key price levels using pivot point analysis
- **Crossover Detection**: Golden cross (50/200 SMA bullish) and death cross (bearish)
- **ASCII Charts**: Visual trend representation in terminal
- **Volatility Metrics**: Standard deviation and Average True Range

## Parameters

| Parameter | Required | Description | Examples |
|-----------|----------|-------------|----------|
| `symbol` | Yes | Stock ticker symbol | `AAPL`, `MSFT`, `GOOGL` |
| `period` | Yes | Time period for analysis | `3m`, `6m`, `1y`, `5y` |
| `indicator` | Yes | Type of data to analyze | `price`, `revenue`, `earnings` |
| `resolution` | No | Data resolution (default: daily) | `daily`, `weekly`, `monthly` |
| `detectSeasonality` | No | Enable seasonality detection | `true`, `false` |

## Examples

```bash
# Analyze 1-year price trend for Apple (default daily resolution)
claude-code skill trend-analysis --symbol "AAPL" --period "1y" --indicator "price"

# Analyze 5-year revenue trend for Microsoft
claude-code skill trend-analysis --symbol "MSFT" --period "5y" --indicator "revenue"

# Detect seasonal patterns in retail stock
claude-code skill trend-analysis --symbol "WMT" --period "5y" --indicator "price" --detectSeasonality

# Weekly analysis for shorter term trends
claude-code skill trend-analysis --symbol "TSLA" --period "6m" --indicator "price" --resolution "weekly"
```

## Output Format

The skill provides a comprehensive analysis including:

### Trend Summary
- **Direction**: UPTREND / DOWNTREND / SIDEWAYS
- **Strength**: Percentage gain/loss over the period
- **Annualized Rate**: CAGR if applicable

### Technical Indicators
- **Moving Averages**: SMA20, SMA50, SMA200, EMA12, EMA26
- **Crossovers**: Recent golden crosses (bullish) and death crosses (bearish)
- **Support Levels**: Key price floors identified from local minima
- **Resistance Levels**: Key price ceilings identified from local maxima

### Key Events
- **Inflection Points**: Peaks and troughs with dates and magnitude
- **Volatility**: Standard deviation and Average True Range

### Visualizations
- **ASCII Chart**: Terminal-friendly trend visualization with arrows (▲ bullish, ▼ bearish)

### Interpretation
- Actionable insights based on trend analysis
- Context on trend sustainability
- Comparison of short-term vs long-term trends

## Trend Interpretation Guide

### Uptrend (Bullish)
- Price is making higher highs and higher lows
- Consider buying on dips toward support levels
- Golden cross (50-day SMA above 200-day SMA) confirms strength

### Downtrend (Bearish)
- Price is making lower highs and lower lows
- Consider waiting for trend reversal confirmation
- Death cross (50-day SMA below 200-day SMA) confirms weakness

### Sideways (Neutral)
- Price is range-bound with no clear direction
- Wait for breakout above resistance or breakdown below support
- Often indicates consolidation before next move

## Period Selection Guide

| Period | Best For | Typical Use |
|--------|----------|-------------|
| `3m` | Short-term trading | Swing trading, earnings season |
| `6m` | Medium-term trends | Position trading, sector rotation |
| `1y` | Standard analysis | General investment decisions |
| `5y` | Long-term trends | Retirement planning, fundamental analysis |

## Notes

- Trend analysis uses statistical methods and should be used with other analysis tools
- Past trends do not guarantee future results
- Volatility metrics help assess risk
- Seasonality is most relevant for retail, energy, and agricultural stocks
