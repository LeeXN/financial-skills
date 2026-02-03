# Financial Data MCP Server

A Model Context Protocol (MCP) server that provides access to financial data using Finnhub, Alpha Vantage, TwelveData, and Tiingo APIs.

## Features

- **Real-time stock quotes**: Get current prices, changes, and daily ranges
- **Historical price data**: Retrieve daily, weekly, monthly stock price history
- **Financial statements**: Access income statements, balance sheets, and cash flow statements
- **Company information**: Get company overview, metrics, and market capitalization
- **Stock news**: Latest news and headlines for any ticker
- **Technical indicators**: SMA, EMA, RSI, MACD, and 50+ more indicators
- **Debug logging**: Configurable log levels for troubleshooting

## Data Sources

| Source | Features | Free Tier | API Key |
|---------|----------|-----------|----------|
| **Finnhub** | Real-time quotes, financials, news, SEC filings | 60 calls/min (no daily limit) | Get key at [finnhub.io](https://finnhub.io/register) |
| **Alpha Vantage** | Historical prices, technical indicators, company overview | 25 calls/day (5 calls/min) | Get key at [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| **TwelveData** | Real-time quotes, historical data, technical indicators | 800 calls/day | Get key at [twelvedata.com](https://twelvedata.com/pricing) |
| **Tiingo** | IEX quotes, EOD prices, news, fundamentals | 500 requests/hour | Get key at [tiingo.com](https://www.tiingo.com/account/api/token) |

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your API keys:
   ```bash
   FINNHUB_API_KEY=your_finnhub_api_key_here
   ALPHAVANTAGE_API_KEY=your_alpha_vantage_api_key_here
   TWELVEDATA_API_KEY=your_twelvedata_api_key_here
   TIINGO_API_KEY=your_tiingo_api_key_here
   ```

5. Build the project:
   ```bash
   npm run build
   ```

## Usage

Start the MCP server:
```bash
npm start
```

The server will start and listen for MCP protocol messages on stdin/stdout.

## Available Tools

### get_stock_quote

Get real-time stock quote for a given symbol.

**Parameters:**
- `symbol` (required): Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)
- `source` (optional): Data source - `finnhub` or `alphavantage` (default: finnhub)

**Example:**
```json
{
  "name": "get_stock_quote",
  "arguments": {
    "symbol": "AAPL",
    "source": "finnhub"
  }
}
```

### get_stock_price_history

Get historical stock price data.

**Parameters:**
- `symbol` (required): Stock ticker symbol
- `source` (optional): Data source - `finnhub` or `alphavantage` (default: finnhub)
- `resolution` (optional): Time resolution - `D`, `W`, `M`, `1`, `5`, `15`, `30`, `60` for Finnhub; `daily`, `weekly`, `monthly` for Alpha Vantage
- `from` (optional): Start date
- `to` (optional): End date
- `outputsize` (optional): `compact` or `full` (Alpha Vantage only)

**Example:**
```json
{
  "name": "get_stock_price_history",
  "arguments": {
    "symbol": "MSFT",
    "source": "alphavantage",
    "resolution": "daily"
  }
}
```

### get_financials

Get company financial statements (income, balance sheet, cash flow).

**Parameters:**
- `symbol` (required): Stock ticker symbol
- `source` (optional): Data source - `finnhub` or `alphavantage` (default: finnhub)
- `period` (optional): Reporting period - `annual` or `quarterly` (default: annual)
- `statementType` (optional): Type of statement - `income`, `balance`, `cash`, or `all` (default: all)

**Example:**
```json
{
  "name": "get_financials",
  "arguments": {
    "symbol": "GOOGL",
    "source": "finnhub",
    "period": "quarterly",
    "statementType": "income"
  }
}
```

### get_company_info

Get company information (name, industry, sector, market cap, shares outstanding).

**Parameters:**
- `symbol` (required): Stock ticker symbol
- `source` (optional): Data source - `finnhub` or `alphavantage` (default: finnhub)

**Example:**
```json
{
  "name": "get_company_info",
  "arguments": {
    "symbol": "TSLA",
    "source": "alphavantage"
  }
}
```

### get_news

Get company news and headlines.

**Parameters:**
- `symbol` (required): Stock ticker symbol
- `source` (optional): Data source - must be `finnhub` (default: finnhub)
- `category` (optional): News category - `general`, `forex`, `crypto`, `merger`
- `minId` (optional): Minimum news ID to fetch

**Example:**
```json
{
  "name": "get_news",
  "arguments": {
    "symbol": "NVDA",
    "source": "finnhub",
    "category": "general"
  }
}
```

### get_technical_indicator

Get technical indicators for stock analysis.

**Parameters:**
- `symbol` (required): Stock ticker symbol
- `source` (optional): Data source - must be `alphavantage` (default: alphavantage)
- `indicator` (optional): Indicator name - `SMA`, `EMA`, `RSI`, `MACD`, etc.
- `interval` (optional): Time interval - `1min`, `5min`, `15min`, etc.
- `time_period` (optional): Number of data points for calculation

**Example:**
```json
{
  "name": "get_technical_indicator",
  "arguments": {
    "symbol": "AAPL",
    "source": "alphavantage",
    "indicator": "RSI",
    "interval": "daily",
    "time_period": "14"
  }
}
```

## Configuration

The server reads configuration from environment variables:

- `FINNHUB_API_KEY`: Your Finnhub API key
- `ALPHAVANTAGE_API_KEY`: Your Alpha Vantage API key
- `TWELVEDATA_API_KEY`: Your TwelveData API key (optional)
- `TIINGO_API_KEY`: Your Tiingo API key (optional)
- `LOG_LEVEL`: Logging level - `DEBUG`, `INFO`, `WARN`, `ERROR` (default: INFO)

Set these in your `.env` file before starting the server.

### Log Levels

| Level | Description |
|-------|-------------|
| `DEBUG` | Detailed request/response logging, timing metrics, key rotation events |
| `INFO` | Request success/failure summary (default) |
| `WARN` | Warnings about rate limits, missing keys |
| `ERROR` | Error messages only |

### Debug Logging Example

To enable debug logging for troubleshooting:

```bash
LOG_LEVEL=DEBUG npm start
```

Debug output includes:
- Full request arguments
- API source selection decisions
- Request timing (duration in ms)
- Response size and preview
- Key rotation and failover events

### Smart Source Selection

The server automatically selects the optimal data source for each tool based on each platform's strengths. When a source fails (rate limit, timeout, or error), the server cascades to the next source in priority order.

**Default Priority Order by Tool:**

| Tool | Priority Order |
|------|---------------|
| `get_stock_quote` | Finnhub, TwelveData, Tiingo, Alpha Vantage |
| `get_stock_candles` | TwelveData, Finnhub, Tiingo |
| `get_technical_indicator` | TwelveData, Alpha Vantage |
| `get_daily_prices` | Tiingo, Alpha Vantage, TwelveData |
| `get_news` | Tiingo, Finnhub |
| `get_quote` | TwelveData, Tiingo, Alpha Vantage |
| `get_company_overview` | Tiingo, Alpha Vantage |

**Custom Priority Override:**

You can override the default priority for any tool using environment variables:

```bash
# Example: prioritize Alpha Vantage for stock quotes
SOURCE_PRIORITY_GET_STOCK_QUOTE=alphavantage,finnhub,twelvedata

# Example: use only Finnhub for news
SOURCE_PRIORITY_GET_NEWS=finnhub
```

**How Cascading Failover Works:**

1. When a request is made, the server tries the highest-priority source first
2. If the source fails with a rate limit or transient error:
   - First, key rotation is attempted (if multiple keys are configured)
   - If all keys are exhausted, failover to the next source occurs
3. The process repeats until a source succeeds or all sources are exhausted
4. Debug logging shows which sources were tried and why failover occurred

### Troubleshooting Failover

Enable debug logging to see detailed failover behavior:

```bash
LOG_LEVEL=DEBUG npm start
```

**Common issues:**

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "All sources failed" | All configured sources hit rate limits | Add more API keys, wait for cooldown, or reduce request frequency |
| Requests always use same source | Other sources not configured | Add API keys for additional sources |
| Failover takes too long | Timeouts on failing sources | Reduce `API_TIMEOUT_MS` or disable slow sources |

## License

MIT
