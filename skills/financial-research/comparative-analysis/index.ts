import { MCPClientWrapper, MCPToolResult } from '@shared/mcp/client.js';
import { formatCurrency, formatPercentage, formatNumber, formatTable } from '@shared/utils/formatters.js';
import { info, warn, error } from '@shared/utils/logger.js';

export interface CompanyData {
  symbol: string;
  name?: string;
  quote?: StockQuote;
  financials?: CompanyFinancials;
  companyInfo?: CompanyInfo;
  priceHistory?: HistoricalPrice[];
}

export interface StockQuote {
  symbol: string;
  currentPrice: number;
  change: number;
  percentChange: number;
  highPriceOfDay: number;
  lowPriceOfDay: number;
  openPriceOfDay: number;
  previousClosePrice: number;
}

export interface CompanyFinancials {
  symbol: string;
  period?: string;
  incomeStatement?: {
    revenue?: number;
    netIncome?: number;
    grossProfit?: number;
    operatingIncome?: number;
  };
  balanceSheet?: {
    totalAssets?: number;
    totalLiabilities?: number;
    totalEquity?: number;
    sharesOutstanding?: number;
  };
  cashFlowStatement?: {
    operatingCashFlow?: number;
    investingCashFlow?: number;
    financingCashFlow?: number;
    freeCashFlow?: number;
  };
}

export interface CompanyInfo {
  symbol: string;
  companyName: string;
  industry?: string;
  sector?: string;
  marketCap?: number;
  sharesOutstanding?: number;
  description?: string;
}

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ComparativeMetrics {
  symbol: string;
  name: string;
  quote?: {
    currentPrice: number;
    percentChange: number;
  };
  revenue?: number;
  revenueGrowth?: number;
  netIncome?: number;
  profitMargin?: number;
  marketCap?: number;
  peRatio?: number;
  pbRatio?: number;
  stockReturn?: number;
  totalReturn?: number;
}

export interface ComparisonResult {
  companies: CompanyData[];
  metrics: ComparativeMetrics[];
  summary: string;
  tables: string[];
}

export class ComparativeAnalysisSkill {
  constructor(private mcpClient: MCPClientWrapper) {}

  async compare(
    symbols: string[],
    options: {
      period?: 'annual' | 'quarterly';
      timeframe?: string;
      metrics?: string[];
    } = {}
  ): Promise<ComparisonResult> {
    info('Starting comparative analysis', { symbols, options });

    const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];
    info(`Processing ${uniqueSymbols.length} companies`, { companies: uniqueSymbols.join(', ') });

    const companies: CompanyData[] = [];

    for (const symbol of uniqueSymbols) {
      const companyData = await this.gatherCompanyData(symbol, options);
      companies.push(companyData);
    }

    const metrics = this.calculateMetrics(companies);
    const tables = this.generateTables(metrics);
    const summary = this.generateSummary(metrics, options);

    return {
      companies,
      metrics,
      summary,
      tables
    };
  }

  private async gatherCompanyData(
    symbol: string,
    options: { period?: string; timeframe?: string }
  ): Promise<CompanyData> {
    const data: CompanyData = { symbol };

    try {
      info(`Fetching data for ${symbol}`);
      const [quote, financials, companyInfo] = await Promise.all([
        this.fetchQuote(symbol),
        this.fetchFinancials(symbol, options.period || 'annual'),
        this.fetchCompanyInfo(symbol)
      ]);

      data.quote = quote;
      data.financials = financials;
      data.companyInfo = companyInfo;

      if (companyInfo?.companyName) {
        data.name = companyInfo.companyName;
      }

      info(`Data fetched for ${symbol}`, {
        hasQuote: !!quote,
        hasFinancials: !!financials,
        hasInfo: !!companyInfo
      });

      return data;
    } catch (err) {
      warn(`Error fetching data for ${symbol}`, { error: err });
      return data;
    }
  }

  private async fetchQuote(symbol: string): Promise<StockQuote | undefined> {
    try {
      const result = await this.mcpClient.invokeTool('get_stock_quote', {
        symbol,
        source: 'finnhub'
      });

      if (result.success && result.normalized) {
        const data = result.normalized as any;
        return {
          symbol,
          currentPrice: data.c?.currentPrice || 0,
          change: data.c?.change || 0,
          percentChange: data.c?.percentChange || 0,
          highPriceOfDay: data.c?.highPriceOfDay || 0,
          lowPriceOfDay: data.c?.lowPriceOfDay || 0,
          openPriceOfDay: data.c?.openPriceOfDay || 0,
          previousClosePrice: data.c?.previousClosePrice || 0
        };
      }
    } catch (err) {
      error(`Quote fetch error for ${symbol}`, { error: err });
      return undefined;
    }
  }

  private async fetchFinancials(
    symbol: string,
    period: string
  ): Promise<CompanyFinancials | undefined> {
    try {
      const result = await this.mcpClient.invokeTool('get_financials', {
        symbol,
        source: 'finnhub',
        period,
        statementType: 'all'
      });

      if (result.success && result.normalized) {
        return result.normalized as CompanyFinancials;
      }
    } catch (err) {
      warn(`Financials fetch error for ${symbol}`, { error: err });
      return undefined;
    }
  }

  private async fetchCompanyInfo(
    symbol: string
  ): Promise<CompanyInfo | undefined> {
    try {
      const result = await this.mcpClient.invokeTool('get_company_info', {
        symbol,
        source: 'finnhub'
      });

      if (result.success && result.normalized) {
        return result.normalized as CompanyInfo;
      }
    } catch (err) {
      warn(`Company info fetch error for ${symbol}`, { error: err });
      return undefined;
    }
  }

  private calculateMetrics(companies: CompanyData[]): ComparativeMetrics[] {
    return companies.map(company => {
      const metrics: ComparativeMetrics = {
        symbol: company.symbol,
        name: company.name || company.symbol
      };

      if (company.quote?.currentPrice && company.companyInfo?.marketCap && company.companyInfo?.sharesOutstanding) {
        metrics.marketCap = company.companyInfo.marketCap;
        metrics.quote = {
          currentPrice: company.quote.currentPrice,
          percentChange: company.quote.percentChange
        };
        metrics.peRatio = company.quote.currentPrice / (company.companyInfo.sharesOutstanding * (company.financials?.incomeStatement?.netIncome || 1));
      }

      if (company.financials?.incomeStatement?.revenue) {
        metrics.revenue = company.financials.incomeStatement.revenue;
      }

      if (company.financials?.incomeStatement?.netIncome) {
        metrics.netIncome = company.financials.incomeStatement.netIncome;
        if (metrics.revenue && metrics.revenue > 0) {
          metrics.profitMargin = (metrics.netIncome / metrics.revenue) * 100;
        }
      }

      if (company.financials?.balanceSheet?.totalAssets && company.financials?.balanceSheet?.totalEquity) {
        metrics.pbRatio = company.financials.balanceSheet.totalEquity / company.financials.balanceSheet.totalAssets;
      }

      if (company.quote?.percentChange) {
        metrics.stockReturn = company.quote.percentChange;
        metrics.totalReturn = company.quote.percentChange;
      }

      return metrics;
    });
  }

  private generateTables(metrics: ComparativeMetrics[]): string[] {
    const tables: string[] = [];

    const summaryTable = this.createSummaryTable(metrics);
    tables.push(summaryTable);

    if (metrics.some(m => m.revenue)) {
      const revenueTable = this.createRevenueTable(metrics);
      tables.push(revenueTable);
    }

    if (metrics.some(m => m.profitMargin !== undefined)) {
      const profitabilityTable = this.createProfitabilityTable(metrics);
      tables.push(profitabilityTable);
    }

    if (metrics.some(m => m.peRatio !== undefined)) {
      const valuationTable = this.createValuationTable(metrics);
      tables.push(valuationTable);
    }

    return tables;
  }

  private createSummaryTable(metrics: ComparativeMetrics[]): string {
    const headers = ['Company', 'Market Cap', 'Current Price', 'Change'];
    const rows = metrics.map(m => [
      m.name,
      m.marketCap ? formatCurrency(m.marketCap) : 'N/A',
      m.quote?.currentPrice ? formatCurrency(m.quote.currentPrice) : 'N/A',
      m.quote?.percentChange ? formatPercentage(m.quote.percentChange) : 'N/A'
    ]);

    return formatTable(headers, rows);
  }

  private createRevenueTable(metrics: ComparativeMetrics[]): string {
    const headers = ['Company', 'Revenue', 'Net Income', 'Profit Margin'];
    const rows = metrics.map(m => [
      m.name,
      m.revenue ? formatCurrency(m.revenue) : 'N/A',
      m.netIncome ? formatCurrency(m.netIncome) : 'N/A',
      m.profitMargin !== undefined ? formatPercentage(m.profitMargin) : 'N/A'
    ]);

    return formatTable(headers, rows);
  }

  private createProfitabilityTable(metrics: ComparativeMetrics[]): string {
    const headers = ['Company', 'Profit Margin', 'P/E Ratio', 'P/B Ratio'];
    const rows = metrics.map(m => [
      m.name,
      m.profitMargin !== undefined ? formatPercentage(m.profitMargin) : 'N/A',
      m.peRatio ? m.peRatio.toFixed(2) : 'N/A',
      m.pbRatio ? m.pbRatio.toFixed(2) : 'N/A'
    ]);

    return formatTable(headers, rows);
  }

  private createValuationTable(metrics: ComparativeMetrics[]): string {
    const headers = ['Company', 'Market Cap', 'P/E', 'P/B'];
    const rows = metrics.map(m => [
      m.name,
      m.marketCap ? formatCurrency(m.marketCap) : 'N/A',
      m.peRatio ? m.peRatio.toFixed(2) : 'N/A',
      m.pbRatio ? m.pbRatio.toFixed(2) : 'N/A'
    ]);

    return formatTable(headers, rows);
  }

  private generateSummary(metrics: ComparativeMetrics[], options: any): string {
    const companiesWithRevenue = metrics.filter(m => m.revenue !== undefined);

    if (companiesWithRevenue.length === 0) {
      return 'Unable to perform comparison - no revenue data available for any company.';
    }

    const highestRevenue = Math.max(...companiesWithRevenue.map(m => m.revenue || 0));
    const lowestPE = Math.min(...metrics.filter(m => m.peRatio !== undefined).map(m => m.peRatio || Infinity));
    const highestMargin = Math.max(...metrics.filter(m => m.profitMargin !== undefined).map(m => m.profitMargin || -Infinity));
    const bestPerformer = metrics.find(m => m.marketCap === highestRevenue);

    let summary = '## Comparative Analysis Summary\n\n';

    summary += `Companies Analyzed: ${metrics.map(m => m.name).join(', ')}\n\n`;

    summary += '### Key Findings\n\n';

    summary += `**Largest by Revenue**: ${metrics.find(m => m.revenue === highestRevenue)?.name} (${formatCurrency(highestRevenue)})\n`;

    if (!isNaN(lowestPE)) {
      summary += `**Lowest P/E Ratio**: ${metrics.find(m => m.peRatio === lowestPE)?.name} (${lowestPE.toFixed(2)})\n`;
    }

    if (!isNaN(highestMargin)) {
      summary += `**Highest Profit Margin**: ${metrics.find(m => m.profitMargin === highestMargin)?.name} (${formatPercentage(highestMargin)})\n`;
    }

    if (bestPerformer) {
      summary += `**Largest by Market Cap**: ${bestPerformer.name} (${formatCurrency(bestPerformer.marketCap || 0)})\n`;
    }

    const bestReturn = metrics.reduce((best, current) => {
      if (current.stockReturn !== undefined && (best?.stockReturn || -Infinity) < current.stockReturn) {
        return current;
      }
      return best;
    }, metrics[0]);

    if (bestReturn && bestReturn.stockReturn !== undefined) {
      summary += `**Best Stock Performance**: ${bestReturn.name} (${formatPercentage(bestReturn.stockReturn)})\n`;
    }

    summary += '\n### Detailed Comparisons\n\n';
    summary += 'See tables below for detailed metrics across all companies.\n';

    return summary;
  }
}
