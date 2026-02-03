# News Sentiment Analysis Skill

Analyzes news articles to determine market sentiment, identify key themes, and correlate sentiment with price movements.

## Usage

```bash
claude-code skill news-sentiment --symbol "AAPL" --days 7
```

## Capabilities

- **News Retrieval**: Fetches recent news from Finnhub API with relevance filtering
- **Sentiment Classification**: Classifies headlines as positive, negative, or neutral
- **Sentiment Scoring**: Calculates sentiment scores on -1 to +1 scale
- **Trend Analysis**: Tracks sentiment changes over time
- **Price Correlation**: Correlates sentiment with stock price movements
- **Theme Extraction**: Identifies key themes driving sentiment (earnings, products, regulation, etc.)
- **Dashboard**: Visual sentiment presentation with actionable insights

## Parameters

| Parameter | Required | Description | Examples |
|-----------|----------|-------------|----------|
| `symbol` | Yes | Stock ticker symbol | `AAPL`, `TSLA`, `MSFT` |
| `days` | No | Number of days to analyze (default: 7) | `1`, `7`, `30` |
| `category` | No | News category filter | `general`, `forex`, `crypto`, `merger` |
| `minArticles` | No | Minimum articles for analysis (default: 10) | `5`, `10`, `20` |
| `correlatePrice` | No | Correlate with price data (default: true) | `true`, `false` |

## Examples

```bash
# Analyze sentiment for Apple over past week
claude-code skill news-sentiment --symbol "AAPL" --days 7

# Analyze Tesla sentiment with price correlation
claude-code skill news-sentiment --symbol "TSLA" --days 30 --correlatePrice

# Analyze crypto sentiment
claude-code skill news-sentiment --symbol "BTC" --days 7 --category "crypto"

# Analyze with minimum article threshold
claude-code skill news-sentiment --symbol "NVDA" --days 14 --minArticles 20
```

## Output Format

### Sentiment Score
- **Range**: -1 (extremely bearish) to +1 (extremely bullish)
- **Classification**: Strong Buy, Buy, Neutral, Sell, Strong Sell

### Sentiment Distribution
- Percentage of positive, negative, and neutral articles
- Most positive and most negative headlines with dates

### Trend Analysis
- Sentiment direction over time (improving, worsening, stable)
- Recent sentiment change (7-day, 30-day)

### Price Correlation
- Correlation coefficient between sentiment and price
- Key sentiment events with corresponding price reactions
- Divergences noted (e.g., negative sentiment with rising price)

### Themes
- Dominant themes driving sentiment
- Theme breakdown with sentiment contribution
- Notable theme shifts over time

### Dashboard Summary
```
┌─────────────────────────────────────────────────────────────┐
│  NEWS SENTIMENT DASHBOARD: AAPL                              │
├─────────────────────────────────────────────────────────────┤
│  Overall Sentiment:   ████████░░ 0.62 (Bullish)            │
│  7-Day Change:        ██████░░░░ +0.15 (Improving)          │
│  Article Count:       42 articles                            │
├─────────────────────────────────────────────────────────────┤
│  Distribution:         ██████ 48% Positive                   │
│                       ██░░░░ 14% Negative                    │
│                       ████░░ 38% Neutral                    │
├─────────────────────────────────────────────────────────────┤
│  Top Themes:           Earnings (12), Products (8),         │
│                        Regulation (5), Management (4)         │
├─────────────────────────────────────────────────────────────┤
│  Price Correlation:    0.67 (Moderate positive)            │
│  Recent Divergence:    Negative sentiment but price up 3%    │
└─────────────────────────────────────────────────────────────┘
```

## Sentiment Interpretation

### Strong Buy (+0.5 to +1.0)
- Overwhelmingly positive news flow
- May indicate overbought conditions
- Consider taking profits on extreme readings

### Buy (0.1 to +0.5)
- Positive news outweighs negative
- Favorable risk/reward for long positions
- Monitor for sentiment shift

### Neutral (-0.1 to +0.1)
- Balanced news flow
- Wait for catalyst for directional move
- Suitable for options strategies

### Sell (-0.1 to -0.5)
- Negative news dominates
- Caution warranted for long positions
- Consider hedging or reducing exposure

### Strong Sell (-0.5 to -1.0)
- Overwhelmingly negative news flow
- May indicate oversold conditions
- Contrarian opportunity possible at extremes

## Notes

- Sentiment analysis uses NLP on headlines and summaries
- Recent news is weighted more heavily
- Correlation with price doesn't imply causation
- Low article volume reduces confidence in signals
- Always combine with fundamental and technical analysis
