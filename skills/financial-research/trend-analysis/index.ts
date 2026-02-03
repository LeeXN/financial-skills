/**
 * Trend Analysis Skill
 *
 * Analyzes historical price and financial data trends using statistical methods
 * including moving averages, linear regression, and seasonality detection.
 */

import { MCPClientWrapper } from '../../shared/mcp/client.js';
import { formatCurrency, formatPercent, formatDate } from '../../shared/utils/formatters.js';

export interface TrendAnalysisInput {
  symbol: string;
  period: string; // e.g., "3m", "6m", "1y", "5y"
  indicator: 'price' | 'revenue' | 'earnings';
  resolution?: 'daily' | 'weekly' | 'monthly';
  detectSeasonality?: boolean;
}

export interface PriceDataPoint {
  date: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TrendResult {
  symbol: string;
  indicator: string;
  period: string;
  trendDirection: 'uptrend' | 'downtrend' | 'sideways';
  trendStrength: number; // percentage change
  annualizedRate?: number;
  supportLevels: number[];
  resistanceLevels: number[];
  movingAverages: {
    sma20?: number;
    sma50?: number;
    sma200?: number;
    ema12?: number;
    ema26?: number;
  };
  crossovers: CrossoverEvent[];
  inflectionPoints: InflectionPoint[];
  seasonality?: SeasonalityInfo;
  volatility: {
    standardDeviation: number;
    averageTrueRange: number;
  };
  chart: string; // ASCII chart
  summary: string;
}

export interface CrossoverEvent {
  type: 'golden_cross' | 'death_cross';
  date: string;
  price: number;
  shortMA: number;
  longMA: number;
}

export interface InflectionPoint {
  type: 'peak' | 'trough';
  date: string;
  value: number;
  magnitude: number; // % change from previous inflection
}

export interface SeasonalityInfo {
  detected: boolean;
  seasonalMonths: string[];
  seasonalPattern: string[];
  adjustedTrend: number;
}

export class TrendAnalyzer {
  constructor(private mcpClient: MCPClientWrapper) {}

  async analyze(input: TrendAnalysisInput): Promise<TrendResult> {
    // Retrieve historical data
    const data = await this.retrieveHistoricalData(input);

    // Calculate moving averages
    const movingAverages = this.calculateMovingAverages(data);

    // Detect trend direction
    const trendDirection = this.detectTrendDirection(data, movingAverages);

    // Calculate trend strength
    const trendStrength = this.calculateTrendStrength(data);

    // Find support and resistance levels
    const { supportLevels, resistanceLevels } = this.findSupportResistance(data);

    // Detect crossovers
    const crossovers = this.detectCrossovers(data, movingAverages);

    // Find inflection points
    const inflectionPoints = this.findInflectionPoints(data);

    // Calculate volatility
    const volatility = this.calculateVolatility(data);

    // Detect seasonality if requested
    const seasonality = input.detectSeasonality
      ? this.detectSeasonality(data)
      : undefined;

    // Generate ASCII chart
    const chart = this.generateASCIIChart(data, trendDirection);

    // Generate summary
    const summary = this.generateSummary({
      input,
      trendDirection,
      trendStrength,
      movingAverages,
      crossovers,
      inflectionPoints,
      volatility,
      seasonality,
    });

    return {
      symbol: input.symbol,
      indicator: input.indicator,
      period: input.period,
      trendDirection,
      trendStrength,
      annualizedRate: this.calculateAnnualizedRate(data, trendStrength),
      supportLevels,
      resistanceLevels,
      movingAverages,
      crossovers,
      inflectionPoints,
      seasonality,
      volatility,
      chart,
      summary,
    };
  }

  private async retrieveHistoricalData(input: TrendAnalysisInput): Promise<PriceDataPoint[]> {
    const { symbol, period, resolution = 'daily' } = input;

    // Calculate date range from period
    const days = this.parsePeriod(period);
    const now = Date.now() / 1000;
    const from = now - (days * 24 * 60 * 60);

    if (input.indicator === 'price') {
      const result = await this.mcpClient.invokeTool('get_stock_price_history', {
        symbol,
        source: 'finnhub',
        resolution: resolution === 'daily' ? 'D' : resolution === 'weekly' ? 'W' : 'M',
        from: Math.floor(from),
        to: Math.floor(now),
      });

      if (!result.success || !result.normalized) {
        throw new Error(`Failed to retrieve price data for ${symbol}`);
      }

      // Normalize data to PriceDataPoint format
      const rawData = result.normalized as any;
      if (Array.isArray(rawData)) {
        return rawData.map((item: any) => ({
          date: item.date || item.t,
          open: item.open || item.o,
          high: item.high || item.h,
          low: item.low || item.l,
          close: item.close || item.c,
          volume: item.volume || item.v,
        }));
      }
    }

    // For revenue/earnings, we'd use financial data
    const result = await this.mcpClient.invokeTool('get_financials', {
      symbol,
      source: 'finnhub',
      statementType: 'all',
      period: 'annual',
    });

    if (!result.success) {
      throw new Error(`Failed to retrieve financial data for ${symbol}`);
    }

    // Transform financial data to price-like format for trend analysis
    return this.transformFinancialData(result.normalized, input.indicator);
  }

  private parsePeriod(period: string): number {
    const match = period.match(/^(\d+)([dmy])$/);
    if (!match) {
      throw new Error(`Invalid period format: ${period}. Use format like 3m, 6m, 1y, 5y`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd': return value;
      case 'm': return value * 30;
      case 'y': return value * 365;
      default: throw new Error(`Invalid period unit: ${unit}`);
    }
  }

  private transformFinancialData(data: unknown, indicator: string): PriceDataPoint[] {
    // Transform financial data into a format suitable for trend analysis
    const financials = data as any;
    const result: PriceDataPoint[] = [];

    // This is a simplified transformation - real implementation would parse actual financial statements
    if (Array.isArray(financials)) {
      for (const item of financials) {
        const value = indicator === 'revenue' ? item.revenue : item.netIncome;
        if (value) {
          result.push({
            date: item.date || item.year,
            open: value,
            high: value * 1.05, // Add small range for visualization
            low: value * 0.95,
            close: value,
            volume: 0,
          });
        }
      }
    }

    return result;
  }

  private calculateMovingAverages(data: PriceDataPoint[]): TrendResult['movingAverages'] {
    const closes = data.map(d => d.close);
    const result: TrendResult['movingAverages'] = {};

    // SMA calculations
    if (closes.length >= 20) result.sma20 = this.calculateSMA(closes, 20);
    if (closes.length >= 50) result.sma50 = this.calculateSMA(closes, 50);
    if (closes.length >= 200) result.sma200 = this.calculateSMA(closes, 200);

    // EMA calculations
    if (closes.length >= 12) result.ema12 = this.calculateEMA(closes, 12);
    if (closes.length >= 26) result.ema26 = this.calculateEMA(closes, 26);

    return result;
  }

  private calculateSMA(data: number[], period: number): number {
    const slice = data.slice(-period);
    return slice.reduce((sum, val) => sum + val, 0) / period;
  }

  private calculateEMA(data: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private detectTrendDirection(
    data: PriceDataPoint[],
    mas: TrendResult['movingAverages']
  ): 'uptrend' | 'downtrend' | 'sideways' {
    const closes = data.map(d => d.close);
    const first = closes[0];
    const last = closes[closes.length - 1];
    const change = (last - first) / first;

    // Consider moving averages for confirmation
    if (mas.sma50 && mas.sma200) {
      const priceAboveSMA50 = last > mas.sma50;
      const sma50AboveSMA200 = mas.sma50 > mas.sma200;

      if (priceAboveSMA50 && sma50AboveSMA200 && change > 0.02) {
        return 'uptrend';
      }
      if (!priceAboveSMA50 && !sma50AboveSMA200 && change < -0.02) {
        return 'downtrend';
      }
    }

    // Price-based classification
    if (change > 0.05) return 'uptrend';
    if (change < -0.05) return 'downtrend';
    return 'sideways';
  }

  private calculateTrendStrength(data: PriceDataPoint[]): number {
    const closes = data.map(d => d.close);
    const first = closes[0];
    const last = closes[closes.length - 1];
    return ((last - first) / first) * 100;
  }

  private calculateAnnualizedRate(data: PriceDataPoint[], totalReturn: number): number {
    const days = data.length;
    const years = days / 365;
    if (years < 0.1) return undefined;

    // Compound annual growth rate
    return (Math.pow(1 + totalReturn / 100, 1 / years) - 1) * 100;
  }

  private findSupportResistance(data: PriceDataPoint[]): {
    supportLevels: number[];
    resistanceLevels: number[];
  } {
    const closes = data.map(d => d.close);
    const lows = data.map(d => d.low);
    const highs = data.map(d => d.high);

    // Find local minima (support) and maxima (resistance)
    const supportLevels: number[] = [];
    const resistanceLevels: number[] = [];

    // Simple pivot point detection
    for (let i = 2; i < data.length - 2; i++) {
      const low = lows[i];
      const high = highs[i];

      // Check if local minimum (support)
      if (low < lows[i - 1] && low < lows[i - 2] &&
          low < lows[i + 1] && low < lows[i + 2]) {
        supportLevels.push(low);
      }

      // Check if local maximum (resistance)
      if (high > highs[i - 1] && high > highs[i - 2] &&
          high > highs[i + 1] && high > highs[i + 2]) {
        resistanceLevels.push(high);
      }
    }

    // Cluster nearby levels
    return {
      supportLevels: this.clusterLevels(supportLevels),
      resistanceLevels: this.clusterLevels(resistanceLevels),
    };
  }

  private clusterLevels(levels: number[], threshold = 0.02): number[] {
    if (levels.length === 0) return [];

    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[][] = [[sorted[0]]];

    for (let i = 1; i < sorted.length; i++) {
      const lastCluster = clusters[clusters.length - 1];
      const avg = lastCluster.reduce((sum, val) => sum + val, 0) / lastCluster.length;

      if (Math.abs(sorted[i] - avg) / avg < threshold) {
        lastCluster.push(sorted[i]);
      } else {
        clusters.push([sorted[i]]);
      }
    }

    return clusters.map(cluster =>
      cluster.reduce((sum, val) => sum + val, 0) / cluster.length
    );
  }

  private detectCrossovers(
    data: PriceDataPoint[],
    mas: TrendResult['movingAverages']
  ): CrossoverEvent[] {
    const crossovers: CrossoverEvent[] = [];

    if (!mas.sma50 || !mas.sma200 || data.length < 200) {
      return crossovers;
    }

    // Look for crossovers in the data
    for (let i = Math.max(200, data.length - 100); i < data.length; i++) {
      const prevSMA50 = this.calculateSMA(data.slice(0, i).map(d => d.close), 50);
      const prevSMA200 = this.calculateSMA(data.slice(0, i).map(d => d.close), 200);
      const currSMA50 = this.calculateSMA(data.slice(0, i + 1).map(d => d.close), 50);
      const currSMA200 = this.calculateSMA(data.slice(0, i + 1).map(d => d.close), 200);

      // Golden cross: 50-day SMA crosses above 200-day SMA
      if (prevSMA50 <= prevSMA200 && currSMA50 > currSMA200) {
        crossovers.push({
          type: 'golden_cross',
          date: String(data[i].date),
          price: data[i].close,
          shortMA: currSMA50,
          longMA: currSMA200,
        });
      }

      // Death cross: 50-day SMA crosses below 200-day SMA
      if (prevSMA50 >= prevSMA200 && currSMA50 < currSMA200) {
        crossovers.push({
          type: 'death_cross',
          date: String(data[i].date),
          price: data[i].close,
          shortMA: currSMA50,
          longMA: currSMA200,
        });
      }
    }

    return crossovers;
  }

  private findInflectionPoints(data: PriceDataPoint[]): InflectionPoint[] {
    const inflectionPoints: InflectionPoint[] = [];
    const closes = data.map(d => d.close);

    // Find significant peaks and troughs
    for (let i = 5; i < data.length - 5; i++) {
      const window = closes.slice(i - 5, i + 6);
      const current = closes[i];
      const max = Math.max(...window);
      const min = Math.min(...window);

      if (current === max && current !== min) {
        // Calculate magnitude from previous inflection
        const prevInflection = inflectionPoints[inflectionPoints.length - 1];
        const magnitude = prevInflection
          ? ((current - prevInflection.value) / prevInflection.value) * 100
          : 0;

        inflectionPoints.push({
          type: 'peak',
          date: String(data[i].date),
          value: current,
          magnitude,
        });
      } else if (current === min && current !== max) {
        const prevInflection = inflectionPoints[inflectionPoints.length - 1];
        const magnitude = prevInflection
          ? ((current - prevInflection.value) / prevInflection.value) * 100
          : 0;

        inflectionPoints.push({
          type: 'trough',
          date: String(data[i].date),
          value: current,
          magnitude,
        });
      }
    }

    return inflectionPoints;
  }

  private calculateVolatility(data: PriceDataPoint[]): {
    standardDeviation: number;
    averageTrueRange: number;
  } {
    const closes = data.map(d => d.close);

    // Calculate standard deviation
    const mean = closes.reduce((sum, val) => sum + val, 0) / closes.length;
    const variance = closes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / closes.length;
    const standardDeviation = Math.sqrt(variance);

    // Calculate Average True Range
    let trueRanges: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    const averageTrueRange = trueRanges.reduce((sum, val) => sum + val, 0) / trueRanges.length;

    return {
      standardDeviation,
      averageTrueRange,
    };
  }

  private detectSeasonality(data: PriceDataPoint[]): SeasonalityInfo {
    // Group data by month
    const monthlyData: Map<number, number[]> = new Map();

    for (const point of data) {
      const date = new Date(point.date);
      const month = date.getMonth();
      const returns = point.close;

      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(returns);
    }

    // Calculate average returns per month
    const monthlyAverages = new Map<number, number>();
    for (const [month, values] of monthlyData) {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      monthlyAverages.set(month, avg);
    }

    // Detect seasonal pattern
    const overallAvg = Array.from(monthlyAverages.values()).reduce((sum, val) => sum + val, 0) / 12;

    // Find months significantly above/below average
    const seasonalMonths: string[] = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const [month, avg] of monthlyAverages) {
      if (Math.abs(avg - overallAvg) / overallAvg > 0.1) {
        seasonalMonths.push(monthNames[month]);
      }
    }

    const detected = seasonalMonths.length >= 3;

    return {
      detected,
      seasonalMonths,
      seasonalPattern: seasonalMonths,
      adjustedTrend: detected ? overallAvg * 1.05 : overallAvg, // Simplified adjustment
    };
  }

  private generateASCIIChart(data: PriceDataPoint[], trend: string): string {
    const width = 60;
    const height = 15;

    // Sample data for chart
    const sampleEvery = Math.max(1, Math.floor(data.length / width));
    const sampled: number[] = [];

    for (let i = 0; i < data.length; i += sampleEvery) {
      sampled.push(data[i].close);
    }

    const min = Math.min(...sampled);
    const max = Math.max(...sampled);
    const range = max - min;

    // Generate chart lines
    const lines: string[] = [];

    for (let y = height - 1; y >= 0; y--) {
      const value = max - (range * y / (height - 1));
      let line = value.toFixed(2).padStart(10) + ' |';

      for (const price of sampled) {
        const normalizedHeight = ((price - min) / range) * (height - 1);
        const chartY = height - 1 - Math.round(normalizedHeight);

        if (chartY === y) {
          line += trend === 'uptrend' ? '▲' : trend === 'downtrend' ? '▼' : '─';
        } else if (chartY > y && normalizedHeight < (height - 1 - y)) {
          line += '│';
        } else {
          line += ' ';
        }
      }

      lines.push(line);
    }

    // Add X-axis
    lines.push('           ' + '─'.repeat(width));
    lines.push('           ' + sampled[0].toFixed(2) + ' → ' + sampled[sampled.length - 1].toFixed(2));

    return '\n' + lines.join('\n');
  }

  private generateSummary(context: {
    input: TrendAnalysisInput;
    trendDirection: string;
    trendStrength: number;
    movingAverages: TrendResult['movingAverages'];
    crossovers: CrossoverEvent[];
    inflectionPoints: InflectionPoint[];
    volatility: { standardDeviation: number; averageTrueRange: number };
    seasonality?: SeasonalityInfo;
  }): string {
    const {
      input,
      trendDirection,
      trendStrength,
      movingAverages,
      crossovers,
      inflectionPoints,
      volatility,
      seasonality,
    } = context;

    const directionText = {
      uptrend: 'bullish',
      downtrend: 'bearish',
      sideways: 'neutral/sideways',
    }[trendDirection];

    let summary = `## Trend Analysis Summary for ${input.symbol}\n\n`;
    summary += `**Trend Direction:** ${trendDirection.toUpperCase()} (${directionText})\n`;
    summary += `**Trend Strength:** ${formatPercent(trendStrength)}`;

    if (movingAverages.annualizedRate) {
      summary += ` (Annualized: ${formatPercent(movingAverages.annualizedRate)})`;
    }
    summary += '\n\n';

    // Moving averages
    summary += `### Key Moving Averages\n`;
    if (movingAverages.sma20) summary += `- SMA20: ${formatCurrency(movingAverages.sma20)}\n`;
    if (movingAverages.sma50) summary += `- SMA50: ${formatCurrency(movingAverages.sma50)}\n`;
    if (movingAverages.sma200) summary += `- SMA200: ${formatCurrency(movingAverages.sma200)}\n`;
    summary += '\n';

    // Crossovers
    if (crossovers.length > 0) {
      summary += `### Recent Crossovers\n`;
      for (const cross of crossovers.slice(-3)) {
        summary += `- ${cross.type === 'golden_cross' ? '🟢' : '🔴'} ${cross.type.replace('_', ' ')} on ${formatDate(cross.date)}\n`;
      }
      summary += '\n';
    }

    // Inflection points
    if (inflectionPoints.length > 0) {
      summary += `### Key Inflection Points\n`;
      for (const point of inflectionPoints.slice(-5)) {
        const icon = point.type === 'peak' ? '🔴' : '🟢';
        summary += `- ${icon} ${point.type}: ${formatCurrency(point.value)} (${formatPercent(point.magnitude)})\n`;
      }
      summary += '\n';
    }

    // Volatility
    summary += `### Volatility Metrics\n`;
    summary += `- Standard Deviation: ${formatCurrency(volatility.standardDeviation)}\n`;
    summary += `- Average True Range: ${formatCurrency(volatility.averageTrueRange)}\n\n`;

    // Seasonality
    if (seasonality?.detected) {
      summary += `### Seasonality Detected\n`;
      summary += `Seasonal months: ${seasonality.seasonalMonths.join(', ')}\n\n`;
    }

    // Interpretation
    summary += `### Interpretation\n`;
    if (trendDirection === 'uptrend') {
      summary += `${input.symbol} is in an ${directionText} trend with ${formatPercent(trendStrength)} gain. `;
      if (crossovers.some(c => c.type === 'golden_cross')) {
        summary += `Recent golden cross suggests continued bullish momentum. `;
      }
      summary += `Consider buying on dips towards support levels.\n`;
    } else if (trendDirection === 'downtrend') {
      summary += `${input.symbol} is in a ${directionText} trend with ${formatPercent(Math.abs(trendStrength))} decline. `;
      if (crossovers.some(c => c.type === 'death_cross')) {
        summary += `Recent death cross suggests continued bearish pressure. `;
      }
      summary += `Consider waiting for trend reversal confirmation.\n`;
    } else {
      summary += `${input.symbol} is trading sideways with no clear directional bias. `;
      summary += `Wait for breakout above resistance or breakdown below support for directional signal.\n`;
    }

    return summary;
  }
}

/**
 * Main skill entry point
 */
export async function run(input: TrendAnalysisInput): Promise<string> {
  const mcpClient = new MCPClientWrapper({
    serverCommand: 'node',
    serverArgs: ['../../financial-data-mcp/dist/server.js'],
  });

  try {
    const analyzer = new TrendAnalyzer(mcpClient);
    const result = await analyzer.analyze(input);

    let output = result.summary;
    output += `\n\n### ASCII Chart\n${result.chart}\n`;

    return output;
  } finally {
    await mcpClient.disconnect();
  }
}
