import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { FinnhubClient } from './api/finnhub.js';
import { AlphaVantageClient } from './api/alphavantage.js';
import { TwelveDataClient } from './api/twelvedata.js';
import { TiingoClient } from './api/tiingo.js';
import { ResilientApiClient } from './resilience/resilient-api-client.js';
import { logger } from './logger.js';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || '';
const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY || '';
const TWELVEDATA_API_KEY = process.env.TWELVEDATA_API_KEY || '';
const TIINGO_API_KEY = process.env.TIINGO_API_KEY || '';

const finnhub = new FinnhubClient(FINNHUB_API_KEY);
const alphavantage = new AlphaVantageClient(ALPHAVANTAGE_API_KEY);
const twelvedata = TWELVEDATA_API_KEY ? new TwelveDataClient(TWELVEDATA_API_KEY) : undefined;
const tiingo = TIINGO_API_KEY ? new TiingoClient(TIINGO_API_KEY) : undefined;

const resilientApiClient: ResilientApiClient = new ResilientApiClient(
  finnhub,
  alphavantage,
  twelvedata,
  tiingo
);

const TOOLS = [
  {
    name: 'get_stock_quote',
    description: 'Get real-time stock quote',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol (e.g., AAPL, MSFT)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_stock_candles',
    description: 'Get historical candle data',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
        resolution: {
          type: 'string',
          description: 'Time resolution (1, 5, 15, 60, D, W, M)',
        },
        from: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        to: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_company_basic_financials',
    description: 'Get company basic financials',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_company_metrics',
    description: 'Get company metrics',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
        metricType: {
          type: 'string',
          description: 'Metric type (all, income_statement, balance_sheet, cash_flow_statement)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_news',
    description: 'Get news for a symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
        category: {
          type: 'string',
          description: 'News category',
        },
        minId: {
          type: 'string',
          description: 'Minimum news ID',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_daily_prices',
    description: 'Get daily prices',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
        outputsize: {
          type: 'string',
          description: 'Output size (compact, full)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_quote',
    description: 'Get real-time quote',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_company_overview',
    description: 'Get company overview',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_income_statement',
    description: 'Get income statement',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_balance_sheet',
    description: 'Get balance sheet',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_cash_flow',
    description: 'Get cash flow statement',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'get_technical_indicator',
    description: 'Get technical indicator',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock symbol',
        },
        indicator: {
          type: 'string',
          description: 'Indicator name (e.g., SMA, EMA, RSI, MACD)',
        },
        interval: {
          type: 'string',
          description: 'Time interval (1min, 5min, 15min, 60min, daily, weekly, monthly)',
        },
        time_period: {
          type: 'string',
          description: 'Time period',
        },
      },
      required: ['symbol', 'indicator'],
    },
  },
];

const TOOL_METHOD_MAP: Record<string, string> = {
  'get_stock_quote': 'getStockQuote',
  'get_stock_candles': 'getStockCandles',
  'get_company_basic_financials': 'getCompanyBasicFinancials',
  'get_company_metrics': 'getCompanyMetrics',
  'get_news': 'getNews',
  'get_daily_prices': 'getDailyPrices',
  'get_quote': 'getQuote',
  'get_company_overview': 'getCompanyOverview',
  'get_income_statement': 'getIncomeStatement',
  'get_balance_sheet': 'getBalanceSheet',
  'get_cash_flow': 'getCashFlow',
  'get_technical_indicator': 'getTechnicalIndicator',
};

const server = new Server(
  {
    name: 'financial-data-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const transport = new StdioServerTransport();
server.connect(transport);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const startTime = Date.now();

  logger.debug('Tool call received', {
    tool: name,
    arguments: args,
  });

  try {
    const methodName = TOOL_METHOD_MAP[name] || name;
    const typedArgs = args as Record<string, unknown>;
    
    let result: unknown;
    switch (name) {
      case 'get_stock_quote':
      case 'get_quote':
        result = await resilientApiClient.getStockQuote(typedArgs.symbol as string);
        break;
      case 'get_stock_candles': {
        const from = typedArgs.from ? Math.floor(new Date(typedArgs.from as string).getTime() / 1000) : Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
        const to = typedArgs.to ? Math.floor(new Date(typedArgs.to as string).getTime() / 1000) : Math.floor(Date.now() / 1000);
        result = await resilientApiClient.getStockCandles(
          typedArgs.symbol as string,
          (typedArgs.resolution as string) || 'D',
          from,
          to
        );
        break;
      }
      case 'get_company_basic_financials':
        result = await resilientApiClient.getCompanyBasicFinancials(typedArgs.symbol as string);
        break;
      case 'get_company_metrics':
        result = await resilientApiClient.getCompanyMetrics(typedArgs.symbol as string, typedArgs.metricType as string);
        break;
      case 'get_news':
        result = await resilientApiClient.getNews(
          typedArgs.symbol as string,
          typedArgs.category as string,
          typedArgs.minId ? parseInt(typedArgs.minId as string, 10) : undefined
        );
        break;
      case 'get_daily_prices':
        result = await resilientApiClient.getDailyPrices(
          typedArgs.symbol as string,
          (typedArgs.outputsize as 'compact' | 'full') || 'compact'
        );
        break;
      case 'get_company_overview':
        result = await resilientApiClient.getCompanyOverview(typedArgs.symbol as string);
        break;
      case 'get_income_statement':
        result = await resilientApiClient.getIncomeStatement(typedArgs.symbol as string);
        break;
      case 'get_balance_sheet':
        result = await resilientApiClient.getBalanceSheet(typedArgs.symbol as string);
        break;
      case 'get_cash_flow':
        result = await resilientApiClient.getCashFlow(typedArgs.symbol as string);
        break;
      case 'get_technical_indicator':
        result = await resilientApiClient.getTechnicalIndicator(
          typedArgs.symbol as string,
          typedArgs.indicator as string,
          (typedArgs.interval as string) || 'daily',
          (typedArgs.time_period as string) || '14'
        );
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    const duration = Date.now() - startTime;

    logger.debug('Tool call completed', {
      tool: name,
      durationMs: duration,
      responsePreview: JSON.stringify(result).substring(0, 200),
      responseLength: JSON.stringify(result).length,
    });

    logger.info('MCP request succeeded', { tool: name, durationMs: duration });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.debug('Tool call failed', {
      tool: name,
      durationMs: duration,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    logger.error('MCP request failed', {
      tool: name,
      error: (error as Error).message,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: (error as Error).message }),
        },
      ],
      isError: true,
    };
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

logger.info('Financial Data MCP Server running on stdio', {
  dataSources: {
    finnhub: !!FINNHUB_API_KEY,
    alphavantage: !!ALPHAVANTAGE_API_KEY,
    twelvedata: !!TWELVEDATA_API_KEY,
    tiingo: !!TIINGO_API_KEY,
  },
});
