// MCP Server for Financial Data using Finnhub and Alpha Vantage APIs

const { Server } = require('@modelcontextprotocol/sdk');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');
const { FinnhubClient } = require('./api/finnhub.js');
const { AlphaVantageClient } = require('./api/alphavantage.js');
const { TOOLS } = require('./tools/index.js');

// Load environment variables
require('dotenv').config();

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ALPHAVANTAGE_API_KEY = process.env.ALPHAVANTAGE_API_KEY;

const finnhub = new FinnhubClient(FINNHUB_API_KEY);
const alphavantage = new AlphaVantageClient(ALPHAVANTAGE_API_KEY);

class FinancialDataServer {
  constructor() {
    const transport = new StdioServerTransport();
    this.server = new Server(
      {
        name: 'financial-data-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
      transport
    );
  }

  async start() {
    this.registerTools();
    await this.server.start();
    console.error('Financial Data MCP Server running on stdio');
  }

  registerTools() {
    for (const tool of TOOLS) {
      this.server.setRequestHandler(tool.name, async (request) => {
        try {
          const result = await this.handleToolRequest(tool.name, request.params && request.params.arguments);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: (error && error.message) || 'Unknown error' }),
                isError: true,
              },
            ],
          };
        }
      });
    }
  }

  async handleToolRequest(toolName, args) {
    const source = (args && args.source) || 'finnhub';
    const symbol = (args && args.symbol);

    switch (toolName) {
      case 'get_stock_quote':
        if (!symbol) throw new Error('symbol is required');
        if (source === 'finnhub') {
          return await finnhub.getStockQuote(symbol);
        } else {
          return await alphavantage.getQuote(symbol);
        }

      case 'get_stock_price_history':
        if (!symbol) throw new Error('symbol is required');
        const resolution = (args && args.resolution) || 'D';
        const from = (args && args.from) ? this.parseDate(args.from) : Math.floor(Date.now() / 1000 - 365 * 5);
        const to = (args && args.to) ? this.parseDate(args.to) : Math.floor(Date.now() / 1000);
        
        if (source === 'finnhub') {
          return await finnhub.getStockCandles(symbol, resolution, from, to);
        } else {
          return await alphavantage.getDailyPrices(symbol, (args && args.outputsize) || 'compact');
        }

      case 'get_financials':
        if (!symbol) throw new Error('symbol is required');
        if (source === 'finnhub') {
          return await finnhub.getCompanyBasicFinancials(symbol);
        } else {
          const period = (args && args.period) || 'annual';
          switch (period) {
            case 'income':
              return await alphavantage.getIncomeStatement(symbol);
            case 'balance':
              return await alphavantage.getBalanceSheet(symbol);
            case 'cash':
              return await alphavantage.getCashFlow(symbol);
            default:
              return await alphavantage.getIncomeStatement(symbol);
          }
        }

      case 'get_company_info':
        if (!symbol) throw new Error('symbol is required');
        if (source === 'finnhub') {
          return await finnhub.getCompanyMetrics(symbol);
        } else {
          return await alphavantage.getCompanyOverview(symbol);
        }

      case 'get_news':
        if (!symbol) throw new Error('symbol is required');
        if (source !== 'finnhub') {
          throw new Error('Only finnhub supports news');
        }
        return await finnhub.getNews(symbol, (args && args.category), (args && args.minId));

      case 'get_technical_indicator':
        if (!symbol) throw new Error('symbol is required');
        if (source !== 'alphavantage') {
          throw new Error('Only alphavantage supports technical indicators');
        }
        const interval = (args && args.interval) || 'daily';
        const timePeriod = (args && args.time_period) || '14';
        return await alphavantage.getTechnicalIndicator(symbol, (args && args.indicator) || 'SMA', interval, timePeriod);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  parseDate(dateStr) {
    if (dateStr && dateStr.match(/^\d{4}$/)) {
      return parseInt(dateStr.substring(0, 4)) * 1000;
    }
    return dateStr ? parseInt(dateStr) : null;
  }
}

const server = new FinancialDataServer();
server.start().catch(console.error);
