# Financial Skills

[中文版](./README-cn.md) | English

A comprehensive financial research and analysis platform that combines a Model Context Protocol (MCP) server with intelligent orchestration skills for Claude Code and OpenCode frameworks.

## Table of Contents

- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

Get up and running in 5 minutes:

### Prerequisites

- **Node.js** v18 or higher
- **opencode** or **claude** CLI tool
- **API keys** from Finnhub, Alpha Vantage, TwelveData, and Tiingo (free tiers available)

### Step 1: Get API Keys

1. **Finnhub**: Register at [https://finnhub.io/](https://finnhub.io/) for free API key
2. **Alpha Vantage**: Get key at [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
3. **TwelveData**: Get key at [https://twelvedata.com/pricing](https://twelvedata.com/pricing)
4. **Tiingo**: Get key at [https://www.tiingo.com/account/api/token](https://www.tiingo.com/account/api/token)

### Step 2: Install Financial Skills

```bash
# Clone the repository
git clone https://github.com/your-org/financial-skills.git
cd financial-skills

# Set API keys (optional - will prompt if not set)
# For multiple keys, use comma-separated format: key1,key2,key3
export FINNHUB_API_KEY=your_finnhub_key
export ALPHAVANTAGE_API_KEY=your_alphavantage_key
export TWELVEDATA_API_KEY=your_twelvedata_key
export TIINGO_API_KEY=your_tiingo_key
export LOG_LEVEL=INFO

# Run the deployment script
./scripts/deploy.sh
```

**The deployment script will:**
1. Check for Node.js and npm
2. Let you select which CLI to deploy to (opencode, claude, or both)
3. Configure API keys and logging level in `.env` file
4. Install the MCP server and skills
5. Register the MCP in your CLI configuration

### Step 3: Verify Installation

```bash
# Check registered MCP servers
opencode mcp list
# or
claude mcp list
```

You should see `financial-data` in the list.

Restart your IDE - all MCP servers and skills are now ready!

### Step 4: Test the Setup

Try these queries to verify everything works:

**Basic market data:**
```
"What's the current price of Apple stock?"
"Compare AAPL and MSFT market cap"
"Show me Tesla's revenue for the last 4 quarters"
```

**With web search (requires additional MCP):**
```
"Analyze Tesla's recent performance and find news explaining price movements"
"Research NVIDIA's latest earnings and summarize analyst reactions"
```

## Installation

### Automated Installation

The deployment script (`./scripts/deploy.sh`) provides an interactive installation experience:

```bash
./scripts/deploy.sh
```

**Installation flow:**
1. Checks dependencies (Node.js, npm)
2. Selects target CLI (opencode, claude, or both)
3. Configures API keys (optional, can add later)
4. Installs MCP server and skills
5. Registers MCP in CLI configuration

### Setting API Keys

API keys are **optional** during installation. You can:

1. **Set via environment variables** (recommended for automation):
```bash
export FINNHUB_API_KEY=your_key
export ALPHAVANTAGE_API_KEY=your_key
export TWELVEDATA_API_KEY=your_key
export TIINGO_API_KEY=your_key
./scripts/deploy.sh
```

2. **Enter interactively** during deployment

3. **Add later** by editing the `.env` file:
```bash
# For opencode
~/.opencode/mcp-servers/financial-data/.env

# For claude
~/.claude/mcp-servers/financial-data/.env
```

### Multiple API Keys (Rotation)

For better rate limit handling, you can configure multiple API keys:

**Via environment variables:**
```bash
# Comma-separated keys
export FINNHUB_API_KEY=key1,key2,key3
export ALPHAVANTAGE_API_KEY=keyA,keyB,keyC
./scripts/deploy.sh
```

**Or by editing the .env file:**
```bash
FINNHUB_API_KEY=key1,key2,key3
ALPHAVANTAGE_API_KEY=keyA,keyB,keyC
TWELVEDATA_API_KEY=keyX,keyY
TIINGO_API_KEY=keyM,keyN
```

When multiple keys are detected, the system automatically:
- Enables key rotation
- Distributes requests across keys
- Rotates to next key when rate limit is reached

**Or use the interactive prompt** during deployment - select "yes" when asked about multiple keys.

### Manual Installation

If you prefer manual setup:

```bash
# 1. Copy skills (for opencode)
mkdir -p ~/.opencode/skills/
cp -r skills/financial-research ~/.opencode/skills/

# 2. Copy MCP source
mkdir -p ~/.opencode/mcp-servers/financial-data/
cp -r financial-data-mcp/* ~/.opencode/mcp-servers/financial-data/

# 3. Build and install dependencies
cd ~/.opencode/mcp-servers/financial-data/
npm install
npm run build

# 4. Create .env file with your API keys
cat > .env << EOF
FINNHUB_API_KEY=your_finnhub_key
ALPHAVANTAGE_API_KEY=your_alphavantage_key
TWELVEDATA_API_KEY=your_twelvedata_key
TIINGO_API_KEY=your_tiingo_key
LOG_LEVEL=INFO
EOF

# 5. Register MCP (if using jq)
jq --arg name financial-data \
   --arg path "$PWD/dist/server.js" \
   '.mcp[$name] = {
       type: "local",
       command: ["node", $path],
       environment: { 
         FINNHUB_API_KEY: $FINNHUB_API_KEY, 
         ALPHAVANTAGE_API_KEY: $ALPHAVANTAGE_API_KEY,
         TWELVEDATA_API_KEY: $TWELVEDATA_API_KEY,
         TIINGO_API_KEY: $TIINGO_API_KEY,
         LOG_LEVEL: "INFO"
       }
   }' ~/.config/opencode/opencode.json > /tmp/config.json && mv /tmp/config.json ~/.config/opencode/opencode.json
```

### Installation Locations

| CLI | MCP Server | Skills |
|-----|-----------|--------|
| opencode | `~/.opencode/mcp-servers/financial-data/` | `~/.opencode/skills/financial-research/` |
| claude | `~/.claude/mcp-servers/financial-data/` | `~/.claude/skills/financial-research/` |

## Configuration

### API Key Configuration

The MCP server reads API keys from the `.env` file in its installation directory:

**Single key:**
```bash
FINNHUB_API_KEY=your_api_key
ALPHAVANTAGE_API_KEY=your_api_key
TWELVEDATA_API_KEY=your_api_key
TIINGO_API_KEY=your_api_key
LOG_LEVEL=INFO
```

**Multiple keys (comma-separated, enables rotation):**
```bash
FINNHUB_API_KEY=key1,key2,key3
ALPHANTAGE_API_KEY=keyA,keyB,keyC
```

When multiple keys are provided, the system automatically enables key rotation.

### Advanced Configuration

The `.env` file also supports these options:

```bash
# API Failover
API_FAILOVER_ENABLED=true
PRIMARY_API_SOURCE=finnhub
SECONDARY_API_SOURCE=alphavantage

# Retry
RETRY_ENABLED=true
RETRY_MAX_ATTEMPTS=3

# Timeout
API_TIMEOUT_MS=30000

# Circuit Breaker
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5

# Key Rotation (automatically enabled when multiple keys detected)
KEY_ROTATION_ENABLED=true
KEY_ROTATION_RESET_WINDOW_MS=3600000

# Logging
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
```

### MCP Registration

The deployment script automatically registers the MCP server in your CLI configuration.

**For opencode:** `~/.config/opencode/opencode.json`
**For claude:** `~/.claude/settings.json`

## Usage

### Basic Queries

Once installed, you can query financial data:

```
"What's Apple's current stock price?"
"Show me the revenue trend for Microsoft over the last 4 quarters"
"Compare P/E ratios of FAANG stocks"
```

### Tool Usage Examples

#### Get Real-time Stock Quote
```json
{
  "name": "get_stock_quote",
  "arguments": {
    "symbol": "AAPL"
  }
}
```

#### Get Historical Price Data
```json
{
  "name": "get_stock_candles",
  "arguments": {
    "symbol": "MSFT",
    "resolution": "D",
    "from": "2024-01-01",
    "to": "2024-12-31"
  }
}
```

#### Get Company Information
```json
{
  "name": "get_company_overview",
  "arguments": {
    "symbol": "GOOGL"
  }
}
```

#### Get Financial Statements
```json
{
  "name": "get_company_metrics",
  "arguments": {
    "symbol": "TSLA",
    "metricType": "all"
  }
}
```

#### Get Technical Indicators
```json
{
  "name": "get_technical_indicator",
  "arguments": {
    "symbol": "NVDA",
    "indicator": "RSI",
    "interval": "daily",
    "time_period": "14"
  }
}
```

#### Get Company News
```json
{
  "name": "get_news",
  "arguments": {
    "symbol": "AAPL",
    "category": "general"
  }
}
```

### Advanced Features

The MCP server provides these tools:

#### Real-time & Historical Data
- **`get_stock_quote`**: Get real-time stock quote (no source parameter, auto-selected)
- **`get_quote`**: Alias for get_stock_quote with optional source selection
- **`get_stock_candles`**: Get historical candle/OHLCV data with time resolution

#### Financial Information
- **`get_company_basic_financials`**: Get company financial metrics
- **`get_company_metrics`**: Get company metrics (income_statement, balance_sheet, cash_flow_statement)
- **`get_company_overview`**: Get company information (name, industry, sector, market cap)
- **`get_income_statement`**: Get income statement
- **`get_balance_sheet`**: Get balance sheet
- **`get_cash_flow`**: Get cash flow statement
- **`get_daily_prices`**: Get daily price history

#### News & Analysis
- **`get_news`**: Get company news and headlines
- **`get_technical_indicator`**: Get technical indicators (SMA, EMA, RSI, MACD, and 50+ more)

#### Additional Features
- **Smart Source Selection**: Automatic optimal API selection for each tool
- **Cascading Failover**: Automatic fallback to alternative sources on errors
- **Key Rotation**: Distribute requests across multiple API keys
- **Debug Logging**: Configurable log levels (DEBUG, INFO, WARN, ERROR)

### Data Sources

The server supports 6 data sources covering both US and Chinese markets:

| Source | Markets | Features | Free Tier | API Key |
|--------|---------|----------|-----------|---------|
| **Finnhub** | US, Global | Real-time quotes, financials, news, SEC filings | 60 calls/min | [finnhub.io](https://finnhub.io/register) |
| **Alpha Vantage** | US | Historical prices, technical indicators, company overview | 25 calls/day | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| **TwelveData** | US, Global | Real-time quotes, historical data, technical indicators | 800 calls/day | [twelvedata.com](https://twelvedata.com/pricing) |
| **Tiingo** | US | IEX quotes, EOD prices, news, fundamentals | 500 req/hour | [tiingo.com](https://www.tiingo.com/account/api/token) |
| **Sina Finance** | China A-shares | Real-time quotes, K-line data, batch quotes | Unlimited | None required |
| **East Money** | China A-shares | Real-time quotes, historical K-lines | Unlimited | None required |

#### Platform Capabilities

| Capability | Finnhub | Alpha Vantage | TwelveData | Tiingo | Sina | East Money |
|------------|---------|---------------|------------|--------|------|------------|
| Real-time Quotes | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Historical Prices | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Technical Indicators | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Company Overview | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Financial Statements | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| News | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Batch Quotes | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **US Stocks** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **China A-shares** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

#### Market-Aware Routing

The server automatically detects the market from the symbol and routes to appropriate sources:

| Symbol Format | Market | Sources Used |
|---------------|--------|--------------|
| `AAPL`, `MSFT` | US | Finnhub, TwelveData, Tiingo, Alpha Vantage |
| `601899.SH`, `600519.SS` | Shanghai | Sina, East Money |
| `000001.SZ`, `300750.SZ` | Shenzhen | Sina, East Money |
| `430047.BJ` | Beijing | Sina, East Money |

**Example - Query Chinese Stock:**
```json
{
  "name": "get_stock_quote",
  "arguments": {
    "symbol": "601899.SH"
  }
}
```

#### Smart Source Selection

The server automatically selects the optimal data source for each tool based on each platform's strengths. When a source fails (rate limit, timeout, or error), the server cascades to the next source in priority order.

**Default Priority Order by Tool:**

| Tool | Priority Order |
|------|---------------|
| `get_stock_quote` | Finnhub, TwelveData, Tiingo, Alpha Vantage (US) / Sina, East Money (China) |
| `get_stock_candles` | TwelveData, Finnhub, Tiingo (US) / Sina, East Money (China) |
| `get_technical_indicator` | TwelveData, Alpha Vantage |
| `get_daily_prices` | Tiingo, Alpha Vantage, TwelveData (US) / Sina, East Money (China) |
| `get_news` | Tiingo, Finnhub |
| `get_quote` | TwelveData, Tiingo, Alpha Vantage (US) / Sina, East Money (China) |
| `get_company_overview` | Tiingo, Alpha Vantage |

**Custom Priority Override:**

You can override the default priority for any tool using environment variables:

```bash
# Example: prioritize Alpha Vantage for stock quotes
SOURCE_PRIORITY_GET_STOCK_QUOTE=alphavantage,finnhub,twelvedata

# Example: use only Finnhub for news
SOURCE_PRIORITY_GET_NEWS=finnhub
```

### Skills Available

The financial-research skill provides:

- **Comparative Analysis**: Compare multiple companies
- **Trend Analysis**: Analyze historical trends
- **News Sentiment**: Analyze news impact on stock prices
- **Investment Reports**: Generate comprehensive investment summaries

## Troubleshooting

### MCP Server Not Appearing

**Check if MCP is registered:**
```bash
opencode mcp list
# or
claude mcp list
```

**Check the .env file:**
```bash
cat ~/.opencode/mcp-servers/financial-data/.env
```

**Check dist folder exists:**
```bash
ls -la ~/.opencode/mcp-servers/financial-data/dist/server.js
```

### Build Errors

If `npm run build` fails:

1. Ensure you're in the MCP directory
2. Delete `node_modules` and `package-lock.json`, then run `npm install`
3. Check Node.js version (requires v18+)

### API Key Issues

**Invalid API key errors:**
- Verify your keys at [Finnhub](https://finnhub.io/) and [Alpha Vantage](https://www.alphavantage.co/)
- Check for extra spaces in the `.env` file
- Ensure keys don't have quotes

**Rate limit errors:**
- Use multiple API keys (comma-separated)
- Enable retry and circuit breaker options
- Consider upgrading to paid API tiers

### Common Issues

| Issue | Solution |
|-------|----------|
| MCP not connected | Restart your IDE |
| "command not found" | Install Node.js v18+ |
| Build fails | Run `npm install` in MCP directory |
| Skills not loaded | Check skills directory exists |

## Project Structure

```
financial-skills/
├── financial-data-mcp/     # MCP server source
│   ├── src/                  # TypeScript source
│   ├── dist/                 # Compiled JavaScript (pre-built)
│   ├── .env.example          # Environment template
│   └── package.json
├── skills/                    # Skills packages
│   └── financial-research/   # Main financial research skill
├── scripts/                   # Deployment scripts
│   └── deploy.sh             # Main deployment script
└── README.md                  # This file
```

## Development

### Building the MCP Server

```bash
cd financial-data-mcp
npm install
npm run build
```

### Testing the MCP Server

```bash
cd financial-data-mcp
node dist/server.js
```

Then send JSON-RPC requests via stdin.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details.
