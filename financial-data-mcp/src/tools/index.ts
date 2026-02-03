import type * as types from '../types.js';

export const TOOLS = [
  {
    name: 'get_stock_quote',
    description: 'Get real-time stock quote for a given symbol',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol (e.g., AAPL, GOOGL, MSFT)',
        },
        source: {
          type: 'string',
          description: 'Data source: finnhub or alphavantage',
          enum: ['finnhub', 'alphavantage'],
        },
      },
      required: ['symbol', 'source'],
    },
  },
  {
    name: 'get_stock_price_history',
    description: 'Get historical stock price data',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        source: {
          type: 'string',
          description: 'Data source: finnhub or alphavantage',
          enum: ['finnhub', 'alphavantage'],
        },
        resolution: {
          type: 'string',
          description: 'Time resolution: D, W, M for finnhub; daily, weekly, monthly for alphavantage',
          enum: ['1', '5', '15', '30', '60', 'D', 'W', 'M', 'daily', 'weekly', 'monthly'],
        },
        from: {
          type: 'number',
          description: 'Start date timestamp (for finnhub) or YYYY-MM-DD (for alphavantage)',
        },
        to: {
          type: 'number',
          description: 'End date timestamp (for finnhub) or YYYY-MM-DD (for alphavantage)',
        },
      },
      required: ['symbol', 'source', 'resolution'],
    },
  },
  {
    name: 'get_financials',
    description: 'Get company financial statements (income, balance sheet, cash flow)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        source: {
          type: 'string',
          description: 'Data source: finnhub or alphavantage',
          enum: ['finnhub', 'alphavantage'],
        },
        period: {
          type: 'string',
          description: 'Reporting period: annual or quarterly (for finnhub)',
          enum: ['annual', 'quarterly'],
        },
        statementType: {
          type: 'string',
          description: 'Type of financial statement: income, balance, cash, or all',
          enum: ['income', 'balance', 'cash', 'all'],
        },
      },
      required: ['symbol', 'source', 'period'],
    },
  },
  {
    name: 'get_company_info',
    description: 'Get company information (name, industry, sector, market cap)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        source: {
          type: 'string',
          description: 'Data source: finnhub or alphavantage',
          enum: ['finnhub', 'alphavantage'],
        },
      },
      required: ['symbol', 'source'],
    },
  },
  {
    name: 'get_news',
    description: 'Get company news',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        source: {
          type: 'string',
          description: 'Data source (only finnhub supports news)',
          enum: ['finnhub'],
        },
        category: {
          type: 'string',
          description: 'News category: general, forex, crypto, merger',
        },
        minId: {
          type: 'number',
          description: 'Minimum news ID to fetch',
        },
      },
      required: ['symbol', 'source'],
    },
  },
  {
    name: 'get_technical_indicator',
    description: 'Get technical indicators (SMA, EMA, RSI, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Stock ticker symbol',
        },
        source: {
          type: 'string',
          description: 'Data source: finnhub or alphavantage',
          enum: ['finnhub', 'alphavantage'],
        },
        indicator: {
          type: 'string',
          description: 'Technical indicator name (e.g., SMA, EMA, RSI, MACD, BOLL)',
          enum: ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA', 'VWAP', 'T3', 'MACD', 'MACDEXT', 'STOCH', 'STOCHF', 'RSI', 'STOCHRSI', 'WILLR', 'ADX', 'ADXR', 'APO', 'PPO', 'MOM', 'BOP', 'CCI', 'CMO', 'ROC', 'ROCR', 'AROON', 'AROONOSC', 'MFI', 'TRIX', 'ULTOSC', 'DX', 'MINUS_DI', 'PLUS_DI', 'MINUS_DM', 'PLUS_DM', 'BBANDS', 'MIDPOINT', 'MIDPRICE', 'SAR', 'TRANGE', 'ATR', 'NATR', 'AD', 'ADOSC', 'OBV'],
        },
        interval: {
          type: 'string',
          description: 'Time interval: 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly',
          enum: ['1min', '5min', '15min', '30min', '60min', 'daily', 'weekly', 'monthly'],
        },
        timePeriod: {
          type: 'string',
          description: 'Number of data points for indicator calculation',
        },
      },
      required: ['symbol', 'source', 'indicator', 'interval'],
    },
  },
] as const;
