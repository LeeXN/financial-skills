# Financial Skills

中文版 | [English](./README.md)

一个全面的金融研究分析平台，结合了模型上下文协议（MCP）服务器和智能编排技能，用于 Claude Code 和 OpenCode 框架。

## 目录

- [快速开始](#快速开始)
- [安装](#安装)
- [配置](#配置)
- [使用方法](#使用方法)
- [故障排除](#故障排除)
- [项目结构](#项目结构)
- [开发](#开发)
- [贡献](#贡献)
- [许可证](#许可证)

## 快速开始

5 分钟快速上手：

### 前置要求

- **Node.js** v18 或更高版本
- **opencode** 或 **claude** CLI 工具
- **API 密钥**来自 Finnhub、Alpha Vantage、TwelveData 和 Tiingo（提供免费层级）

### 第 1 步：获取 API 密钥

1. **Finnhub**：在 [https://finnhub.io/](https://finnhub.io/) 注册获取免费 API 密钥
2. **Alpha Vantage**：在 [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) 获取密钥
3. **TwelveData**：在 [https://twelvedata.com/pricing](https://twelvedata.com/pricing) 获取密钥
4. **Tiingo**：在 [https://www.tiingo.com/account/api/token](https://www.tiingo.com/account/api/token) 获取密钥

### 第 2 步：安装 Financial Skills

```bash
# 克隆仓库
git clone https://github.com/your-org/financial-skills.git
cd financial-skills

# 设置 API 密钥（可选 - 如未设置会提示输入）
# 支持多密钥，使用逗号分隔格式：key1,key2,key3
export FINNHUB_API_KEY=your_finnhub_key
export ALPHAVANTAGE_API_KEY=your_alphavantage_key
export TWELVEDATA_API_KEY=your_twelvedata_key
export TIINGO_API_KEY=your_tiingo_key
export LOG_LEVEL=INFO

# 运行部署脚本
./scripts/deploy.sh
```

**部署脚本将自动完成：**
1. 检查 Node.js 和 npm
2. 让您选择部署到哪个 CLI（opencode、claude 或两者）
3. 在 `.env` 文件中配置 API 密钥和日志级别
4. 安装 MCP 服务器和技能
5. 在您的 CLI 配置中注册 MCP

### 第 3 步：验证安装

```bash
# 检查已注册的 MCP 服务器
opencode mcp list
# 或
claude mcp list
```

您应该能在列表中看到 `financial-data`。

重启您的 IDE - 所有 MCP 服务器和技能现已就绪！

### 第 4 步：测试设置

尝试以下查询验证一切正常工作：

**基础市场数据：**
```
"苹果股票的当前价格是多少？"
"比较 AAPL 和 MSFT 的市值"
"显示特斯拉过去 4 个季度的收入"
```

**结合网络搜索（需要额外的 MCP）：**
```
"分析特斯拉的近期表现，并查找解释价格变动的新闻"
"研究 NVIDIA 的最新收益并总结分析师反应"
```

## 安装

### 自动安装

部署脚本（`./scripts/deploy.sh`）提供交互式安装体验：

```bash
./scripts/deploy.sh
```

**安装流程：**
1. 检查依赖项（Node.js、npm）
2. 选择目标 CLI（opencode、claude 或两者）
3. 配置 API 密钥（可选，可稍后添加）
4. 安装 MCP 服务器和技能
5. 在 CLI 配置中注册 MCP

### 设置 API 密钥

安装期间 API 密钥是**可选的**。您可以：

1. **通过环境变量设置**（推荐用于自动化）：
```bash
export FINNHUB_API_KEY=your_key
export ALPHAVANTAGE_API_KEY=your_key
export TWELVEDATA_API_KEY=your_key
export TIINGO_API_KEY=your_key
./scripts/deploy.sh
```

2. **在部署期间交互式输入**

3. **稍后添加**，编辑 `.env` 文件：
```bash
# 对于 opencode
~/.opencode/mcp-servers/financial-data/.env

# 对于 claude
~/.claude/mcp-servers/financial-data/.env
```

### 多个 API 密钥（轮换）

为了更好的速率限制处理，您可以配置多个 API 密钥：
```bash
# 逗号分隔的密钥
export FINNHUB_API_KEY=key1,key2,key3
export ALPHAVANTAGE_API_KEY=keyA,keyB,keyC
./scripts/deploy.sh
```

**或通过编辑 .env 文件：**
```bash
FINNHUB_API_KEY=key1,key2,key3
ALPHAVANTAGE_API_KEY=keyA,keyB,keyC
TWELVEDATA_API_KEY=keyX,keyY
TIINGO_API_KEY=keyM,keyN
```

当检测到多个密钥时，系统会自动：
- 启用密钥轮换
- 在密钥之间分配请求
- 达到速率限制时轮换到下一个密钥

**或在部署期间使用交互式提示** - 当询问多个密钥时选择"是"。

### 手动安装

如果您更喜欢手动设置：

```bash
# 1. 复制技能（用于 opencode）
mkdir -p ~/.opencode/skills/
cp -r skills/financial-research ~/.opencode/skills/

# 2. 复制 MCP 源代码
mkdir -p ~/.opencode/mcp-servers/financial-data/
cp -r financial-data-mcp/* ~/.opencode/mcp-servers/financial-data/

# 3. 构建并安装依赖
cd ~/.opencode/mcp-servers/financial-data/
npm install
npm run build

# 4. 使用 API 密钥创建 .env 文件
cat > .env << EOF
FINNHUB_API_KEY=your_finnhub_key
ALPHAVANTAGE_API_KEY=your_alphavantage_key
TWELVEDATA_API_KEY=your_twelvedata_key
TIINGO_API_KEY=your_tiingo_key
LOG_LEVEL=INFO
EOF

# 5. 注册 MCP（如果使用 jq）
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

### 安装位置

| CLI | MCP 服务器 | 技能 |
|-----|-----------|--------|
| opencode | `~/.opencode/mcp-servers/financial-data/` | `~/.opencode/skills/financial-research/` |
| claude | `~/.claude/mcp-servers/financial-data/` | `~/.claude/skills/financial-research/` |

## 配置

### API 密钥配置

MCP 服务器从其安装目录中的 `.env` 文件读取 API 密钥：

**单个密钥：**
```bash
FINNHUB_API_KEY=your_api_key
ALPHAVANTAGE_API_KEY=your_api_key
TWELVEDATA_API_KEY=your_api_key
TIINGO_API_KEY=your_api_key
LOG_LEVEL=INFO
```

**多个密钥（逗号分隔，启用轮换）：**
```bash
FINNHUB_API_KEY=key1,key2,key3
ALPHANTAGE_API_KEY=keyA,keyB,keyC
```

当提供多个密钥时，系统会自动启用密钥轮换。

### 高级配置

`.env` 文件还支持以下选项：

```bash
# API 故障转移
API_FAILOVER_ENABLED=true
PRIMARY_API_SOURCE=finnhub
SECONDARY_API_SOURCE=alphavantage

# 重试
RETRY_ENABLED=true
RETRY_MAX_ATTEMPTS=3

# 超时
API_TIMEOUT_MS=30000

# 熔断器
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5

# 密钥轮换（检测到多个密钥时自动启用）
KEY_ROTATION_ENABLED=true
KEY_ROTATION_RESET_WINDOW_MS=3600000

# 日志记录
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
```

**多个密钥（逗号分隔，启用轮换）：**
```bash
FINNHUB_API_KEY=key1,key2,key3
ALPHAVANTAGE_API_KEY=keyA,keyB,keyC
```

当提供多个密钥时，系统会自动启用密钥轮换。

### 高级配置

`.env` 文件还支持以下选项：

```bash
# API 故障转移
API_FAILOVER_ENABLED=true
PRIMARY_API_SOURCE=finnhub
SECONDARY_API_SOURCE=alphavantage

# 重试
RETRY_ENABLED=true
RETRY_MAX_ATTEMPTS=3

# 超时
API_TIMEOUT_MS=30000

# 熔断器
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5

# 密钥轮换（检测到多个密钥时自动启用）
KEY_ROTATION_ENABLED=true
KEY_ROTATION_RESET_WINDOW_MS=3600000
```

### MCP 注册

部署脚本会自动在您的 CLI 配置中注册 MCP 服务器。

**对于 opencode：** `~/.config/opencode/opencode.json`
**对于 claude：** `~/.claude/settings.json`

## 使用方法

### 基础查询

安装后，您可以查询金融数据：

```
"苹果股票的当前价格是多少？"
"显示微软过去 4 个季度的收入趋势"
"比较 FAANG 股票的市盈率"
```

### 工具使用示例

#### 获取实时股票报价
```json
{
  "name": "get_stock_quote",
  "arguments": {
    "symbol": "AAPL"
  }
}
```

#### 获取历史价格数据
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

#### 获取公司信息
```json
{
  "name": "get_company_overview",
  "arguments": {
    "symbol": "GOOGL"
  }
}
```

#### 获取财务报表
```json
{
  "name": "get_company_metrics",
  "arguments": {
    "symbol": "TSLA",
    "metricType": "all"
  }
}
```

#### 获取技术指标
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

#### 获取公司新闻
```json
{
  "name": "get_news",
  "arguments": {
    "symbol": "AAPL",
    "category": "general"
  }
}
```

### 高级功能

MCP 服务器提供以下工具：

#### 实时与历史数据
- **`get_stock_quote`**: 获取实时股票报价（无需指定源，自动选择）
- **`get_quote`**: get_stock_quote 的别名，支持可选的数据源选择
- **`get_stock_candles`**: 获取历史蜡烛图/OHLCV 数据，支持时间分辨率

#### 财务信息
- **`get_company_basic_financials`**: 获取公司财务指标
- **`get_company_metrics`**: 获取公司指标（income_statement、balance_sheet、cash_flow_statement）
- **`get_company_overview`**: 获取公司信息（名称、行业、板块、市值）
- **`get_income_statement`**: 获取利润表
- **`get_balance_sheet`**: 获取资产负债表
- **`get_cash_flow`**: 获取现金流量表
- **`get_daily_prices`**: 获取每日价格历史

#### 新闻与分析
- **`get_news`**: 获取公司新闻和头条
- **`get_technical_indicator`**: 获取技术指标（SMA、EMA、RSI、MACD 等 50 多种指标）

#### 附加功能
- **智能源选择**：根据每个工具的优势自动选择最佳 API
- **级联故障转移**：发生错误时自动切换到备用源
- **密钥轮换**：在多个 API 密钥之间分配请求
- **调试日志**：可配置的日志级别（DEBUG、INFO、WARN、ERROR）

### 数据来源

服务器支持 6 个数据源，覆盖美国和中国市场：

| 来源 | 市场 | 功能 | 免费层级 | API 密钥 |
|------|------|------|----------|----------|
| **Finnhub** | 美国、全球 | 实时报价、财务数据、新闻、SEC 文件 | 60 次/分钟 | [finnhub.io](https://finnhub.io/register) |
| **Alpha Vantage** | 美国 | 历史价格、技术指标、公司概况 | 25 次/天 | [alphavantage.co](https://www.alphavantage.co/support/#api-key) |
| **TwelveData** | 美国、全球 | 实时报价、历史数据、技术指标 | 800 次/天 | [twelvedata.com](https://twelvedata.com/pricing) |
| **Tiingo** | 美国 | IEX 报价、EOD 价格、新闻、基础数据 | 500 次/小时 | [tiingo.com](https://www.tiingo.com/account/api/token) |
| **新浪财经** | A 股 | 实时报价、K 线数据、批量报价 | 无限制 | 无需密钥 |
| **东方财富** | A 股 | 实时报价、历史 K 线 | 无限制 | 无需密钥 |

#### 平台功能对比

| 功能 | Finnhub | Alpha Vantage | TwelveData | Tiingo | 新浪 | 东方财富 |
|------|---------|---------------|------------|--------|------|----------|
| 实时报价 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 历史价格 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 技术指标 | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| 公司概况 | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| 财务报表 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| 新闻 | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| 批量报价 | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **美股** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **A 股** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

#### 市场感知路由

服务器自动从股票代码检测市场并路由到相应的数据源：

| 代码格式 | 市场 | 使用的数据源 |
|----------|------|--------------|
| `AAPL`、`MSFT` | 美国 | Finnhub、TwelveData、Tiingo、Alpha Vantage |
| `601899.SH`、`600519.SS` | 上海 | 新浪、东方财富 |
| `000001.SZ`、`300750.SZ` | 深圳 | 新浪、东方财富 |
| `430047.BJ` | 北京 | 新浪、东方财富 |

**示例 - 查询 A 股：**
```json
{
  "name": "get_stock_quote",
  "arguments": {
    "symbol": "601899.SH"
  }
}
```

#### 智能源选择

服务器会根据每个平台的优势，为每个工具自动选择最佳数据源。当某个源失败（速率限制、超时或错误）时，服务器会按照优先级顺序级联到下一个源。

**各工具的默认优先级顺序：**

| 工具 | 优先级顺序 |
|------|------------|
| `get_stock_quote` | Finnhub、TwelveData、Tiingo、Alpha Vantage（美股）/ 新浪、东方财富（A 股） |
| `get_stock_candles` | TwelveData、Finnhub、Tiingo（美股）/ 新浪、东方财富（A 股） |
| `get_technical_indicator` | TwelveData、Alpha Vantage |
| `get_daily_prices` | Tiingo、Alpha Vantage、TwelveData（美股）/ 新浪、东方财富（A 股） |
| `get_news` | Tiingo、Finnhub |
| `get_quote` | TwelveData、Tiingo、Alpha Vantage（美股）/ 新浪、东方财富（A 股） |
| `get_company_overview` | Tiingo、Alpha Vantage |

**自定义优先级覆盖：**

您可以使用环境变量为任何工具覆盖默认优先级：

```bash
# 示例：优先使用 Alpha Vantage 获取股票报价
SOURCE_PRIORITY_GET_STOCK_QUOTE=alphavantage,finnhub,twelvedata

# 示例：仅使用 Finnhub 获取新闻
SOURCE_PRIORITY_GET_NEWS=finnhub
```

### 可用技能

financial-research 技能提供：

- **比较分析**：比较多家公司
- **趋势分析**：分析历史趋势
- **新闻情绪**：分析新闻对股价的影响
- **投资报告**：生成综合投资摘要

## 故障排除

### MCP 服务器未出现

**检查 MCP 是否已注册：**
```bash
opencode mcp list
# 或
claude mcp list
```

**检查 .env 文件：**
```bash
cat ~/.opencode/mcp-servers/financial-data/.env
```

**检查 dist 文件夹是否存在：**
```bash
ls -la ~/.opencode/mcp-servers/financial-data/dist/server.js
```

### 构建错误

如果 `npm run build` 失败：

1. 确保您在 MCP 目录中
2. 删除 `node_modules` 和 `package-lock.json`，然后运行 `npm install`
3. 检查 Node.js 版本（需要 v18+）

### API 密钥问题

**无效的 API 密钥错误：**
- 在 [Finnhub](https://finnhub.io/) 和 [Alpha Vantage](https://www.alphavantage.co/) 验证您的密钥
- 检查 `.env` 文件中是否有额外的空格
- 确保密钥没有引号

**速率限制错误：**
- 使用多个 API 密钥（逗号分隔）
- 启用重试和熔断器选项
- 考虑升级到付费 API 层级

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| MCP 未连接 | 重启您的 IDE |
| "command not found" | 安装 Node.js v18+ |
| 构建失败 | 在 MCP 目录中运行 `npm install` |
| 技能未加载 | 检查技能目录是否存在 |

## 项目结构

```
financial-skills/
├── financial-data-mcp/     # MCP 服务器源代码
│   ├── src/                  # TypeScript 源代码
│   ├── dist/                 # 编译的 JavaScript（预构建）
│   ├── .env.example          # 环境模板
│   └── package.json
├── skills/                    # 技能包
│   └── financial-research/   # 主要金融研究技能
├── scripts/                   # 部署脚本
│   └── deploy.sh             # 主部署脚本
└── README.md                  # 本文件
```

## 开发

### 构建 MCP 服务器

```bash
cd financial-data-mcp
npm install
npm run build
```

### 测试 MCP 服务器

```bash
cd financial-data-mcp
node dist/server.js
```

然后通过 stdin 发送 JSON-RPC 请求。

## 贡献

欢迎贡献！请随时提交 issue 或 pull request。

## 许可证

MIT 许可证 - 有关详细信息，请参见 LICENSE 文件。
