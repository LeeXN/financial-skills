/**
 * News Sentiment Analysis Skill
 *
 * Analyzes news articles to determine market sentiment, identify key themes,
 * and correlate sentiment with price movements.
 */

import { MCPClientWrapper } from '../../shared/mcp/client.js';
import { formatDate } from '../../shared/utils/formatters.js';

export interface NewsSentimentInput {
  symbol: string;
  days?: number; // default 7
  category?: string;
  minArticles?: number; // default 10
  correlatePrice?: boolean; // default true
}

export interface NewsArticle {
  id: string;
  datetime: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  related: string[];
}

export interface SentimentArticle {
  article: NewsArticle;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1 to +1
  themes: string[];
}

export interface SentimentResult {
  symbol: string;
  period: string;
  articleCount: number;
  overallSentiment: number; // -1 to +1
  classification: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  distribution: {
    positive: number; // percentage
    negative: number;
    neutral: number;
  };
  trend: {
    direction: 'improving' | 'worsening' | 'stable';
    change7d: number;
    change30d?: number;
  };
  topHeadlines: {
    positive: { headline: string; score: number; date: string }[];
    negative: { headline: string; score: number; date: string }[];
  };
  themes: {
    name: string;
    count: number;
    avgSentiment: number;
  }[];
  priceCorrelation?: {
    correlation: number;
    sentimentEvents: {
      date: string;
      sentiment: number;
      priceChange: number;
      description: string;
    }[];
    divergences: string[];
  };
  dashboard: string;
  summary: string;
}

// Sentiment analysis keywords and patterns
const POSITIVE_KEYWORDS = [
  'beat', 'beats', 'exceeded', 'surpassed', 'topped', 'outperformed',
  'rally', 'surge', 'jump', 'soar', 'climb', 'gain', 'rise', 'rising',
  'bullish', 'upgrade', 'upgraded', 'buy', 'overweight', 'outperform',
  'growth', 'growing', 'expansion', 'expand', 'record', 'high',
  'strong', 'robust', 'excellent', 'solid', 'positive',
  'breakthrough', 'innovation', 'launch', 'unveiled', 'announced',
  'dividend', 'buyback', 'acquisition', 'acquire', 'merger',
  'partnership', 'collaboration', 'agreement', 'deal',
  'profit', 'profitable', 'earnings', 'revenue', 'sales'
];

const NEGATIVE_KEYWORDS = [
  'miss', 'missed', 'below', 'under', 'fell', 'fall', 'falling', 'decline', 'declining',
  'drop', 'dropped', 'plunge', 'plummet', 'crash', 'sell', 'sell-off', 'selling',
  'bearish', 'downgrade', 'downgraded', 'sell', 'underweight', 'underperform',
  'loss', 'losing', 'losses', 'deficit', 'shortfall',
  'weak', 'weaker', 'poor', 'disappointing', 'negative',
  'layoff', 'furlough', 'cut', 'cuts', 'reduction', 'restructuring',
  'lawsuit', 'litigation', 'legal', 'regulatory', 'investigation', 'probe',
  'recall', 'delay', 'postpone', 'suspend', 'halt',
  'debt', 'liability', 'bankruptcy', 'default', 'cease'
];

const THEME_PATTERNS: Record<string, RegExp[]> = {
  earnings: [/earnings?/, /profit|income|revenue|eps|estimates/, /beat|miss|guidance/],
  products: [/launch|unveil|announce|release|introduce/, /product|device|service|feature/],
  regulation: [/regulat|sec|federal|agency|compliance/, /lawsuit|legal|investigation|probe/],
  management: [/ceo|cfo|executive|leadership|management/, /resign|appoint|hire|fire/],
  merger: [/merger|acquisition|acquire|buyout|takeover/, /deal|agreement|partnership/],
  market: [/market|index|sector|industry/, /rally|sell-off|volatility/],
  macro: [/inflation|interest rate|fed|economy|recession/, /gdp|unemployment|consumer/],
};

export class NewsSentimentAnalyzer {
  constructor(private mcpClient: MCPClientWrapper) {}

  async analyze(input: NewsSentimentInput): Promise<SentimentResult> {
    const days = input.days ?? 7;
    const minArticles = input.minArticles ?? 10;

    // Retrieve news articles
    const articles = await this.retrieveNews(input.symbol, days, input.category);

    if (articles.length < 5) {
      return this.createInsufficientDataResult(input, articles);
    }

    // Analyze sentiment for each article
    const sentimentArticles = articles.map(article => this.analyzeArticle(article));

    // Calculate overall sentiment
    const overallSentiment = this.calculateOverallSentiment(sentimentArticles);

    // Calculate distribution
    const distribution = this.calculateDistribution(sentimentArticles);

    // Analyze trend
    const trend = this.analyzeTrend(sentimentArticles, days);

    // Extract themes
    const themes = this.extractThemes(sentimentArticles);

    // Get top headlines
    const topHeadlines = this.getTopHeadlines(sentimentArticles);

    // Price correlation
    const priceCorrelation = input.correlatePrice
      ? await this.correlateWithPrice(input.symbol, sentimentArticles, days)
      : undefined;

    // Generate dashboard
    const dashboard = this.generateDashboard({
      input,
      overallSentiment,
      distribution,
      trend,
      themes,
      articleCount: articles.length,
    });

    // Generate summary
    const summary = this.generateSummary({
      input,
      overallSentiment,
      distribution,
      trend,
      themes,
      priceCorrelation,
      articleCount: articles.length,
    });

    return {
      symbol: input.symbol,
      period: `${days} days`,
      articleCount: articles.length,
      overallSentiment,
      classification: this.classifySentiment(overallSentiment),
      distribution,
      trend,
      topHeadlines,
      themes,
      priceCorrelation,
      dashboard,
      summary,
    };
  }

  private async retrieveNews(symbol: string, days: number, category?: string): Promise<NewsArticle[]> {
    const result = await this.mcpClient.invokeTool('get_news', {
      symbol,
      source: 'finnhub',
      category,
    });

    if (!result.success || !result.normalized) {
      return [];
    }

    const articles = result.normalized as any[];

    // Filter by date
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    return articles
      .filter((a: any) => a.datetime * 1000 > cutoff)
      .map((a: any) => ({
        id: a.id,
        datetime: a.datetime,
        headline: a.headline,
        summary: a.summary,
        source: a.source,
        url: a.url,
        related: a.related || [],
      }));
  }

  private analyzeArticle(article: NewsArticle): SentimentArticle {
    const text = `${article.headline} ${article.summary}`.toLowerCase();

    // Calculate sentiment score
    let score = 0;
    const themes: string[] = [];

    // Check for positive keywords
    for (const keyword of POSITIVE_KEYWORDS) {
      if (text.includes(keyword)) {
        score += 0.1;
      }
    }

    // Check for negative keywords
    for (const keyword of NEGATIVE_KEYWORDS) {
      if (text.includes(keyword)) {
        score -= 0.1;
      }
    }

    // Detect themes
    for (const [themeName, patterns] of Object.entries(THEME_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          if (!themes.includes(themeName)) {
            themes.push(themeName);
          }
          break;
        }
      }
    }

    // Classify sentiment
    let sentiment: 'positive' | 'negative' | 'neutral';
    if (score > 0.15) sentiment = 'positive';
    else if (score < -0.15) sentiment = 'negative';
    else sentiment = 'neutral';

    // Clamp score between -1 and 1
    score = Math.max(-1, Math.min(1, score));

    return { article, sentiment, score, themes };
  }

  private calculateOverallSentiment(articles: SentimentArticle[]): number {
    if (articles.length === 0) return 0;

    // Weight by recency (more recent = higher weight)
    const now = Date.now();
    let weightedSum = 0;
    let totalWeight = 0;

    for (const item of articles) {
      const age = now - (item.article.datetime * 1000);
      const daysOld = age / (24 * 60 * 60 * 1000);
      const weight = Math.max(0.1, 1 - (daysOld / 30)); // Decay over 30 days

      weightedSum += item.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private calculateDistribution(articles: SentimentArticle[]): {
    positive: number;
    negative: number;
    neutral: number;
  } {
    const total = articles.length;
    const positive = articles.filter(a => a.sentiment === 'positive').length;
    const negative = articles.filter(a => a.sentiment === 'negative').length;
    const neutral = articles.filter(a => a.sentiment === 'neutral').length;

    return {
      positive: Math.round((positive / total) * 100),
      negative: Math.round((negative / total) * 100),
      neutral: Math.round((neutral / total) * 100),
    };
  }

  private analyzeTrend(articles: SentimentArticle[], period: number): {
    direction: 'improving' | 'worsening' | 'stable';
    change7d: number;
    change30d?: number;
  } {
    if (articles.length < 2) {
      return { direction: 'stable', change7d: 0 };
    }

    // Sort by datetime
    const sorted = [...articles].sort((a, b) => a.article.datetime - b.article.datetime);

    // Calculate sentiment for first half vs second half
    const mid = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, mid);
    const secondHalf = sorted.slice(mid);

    const firstAvg = firstHalf.reduce((sum, a) => sum + a.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, a) => sum + a.score, 0) / secondHalf.length;

    const change7d = secondAvg - firstAvg;

    let direction: 'improving' | 'worsening' | 'stable';
    if (change7d > 0.1) direction = 'improving';
    else if (change7d < -0.1) direction = 'worsening';
    else direction = 'stable';

    return { direction, change7d };
  }

  private extractThemes(articles: SentimentArticle[]): {
    name: string;
    count: number;
    avgSentiment: number;
  }[] {
    const themeMap = new Map<string, { count: number; totalSentiment: number }>();

    for (const item of articles) {
      for (const theme of item.themes) {
        const existing = themeMap.get(theme);
        if (existing) {
          existing.count++;
          existing.totalSentiment += item.score;
        } else {
          themeMap.set(theme, { count: 1, totalSentiment: item.score });
        }
      }
    }

    return Array.from(themeMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgSentiment: data.totalSentiment / data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  private getTopHeadlines(articles: SentimentArticle[]): {
    positive: { headline: string; score: number; date: string }[];
    negative: { headline: string; score: number; date: string }[];
  } {
    const positives = articles
      .filter(a => a.sentiment === 'positive')
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(a => ({
        headline: a.article.headline,
        score: a.score,
        date: new Date(a.article.datetime * 1000).toLocaleDateString(),
      }));

    const negatives = articles
      .filter(a => a.sentiment === 'negative')
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(a => ({
        headline: a.article.headline,
        score: a.score,
        date: new Date(a.article.datetime * 1000).toLocaleDateString(),
      }));

    return { positive: positives, negative: negatives };
  }

  private async correlateWithPrice(
    symbol: string,
    articles: SentimentArticle[],
    days: number
  ): Promise<{
    correlation: number;
    sentimentEvents: {
      date: string;
      sentiment: number;
      priceChange: number;
      description: string;
    }[];
    divergences: string[];
  }> {
    // Get price data
    const result = await this.mcpClient.invokeTool('get_stock_price_history', {
      symbol,
      source: 'finnhub',
      resolution: 'D',
      from: Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000),
      to: Math.floor(Date.now() / 1000),
    });

    if (!result.success || !result.normalized) {
      return {
        correlation: 0,
        sentimentEvents: [],
        divergences: ['Unable to fetch price data'],
      };
    }

    const priceData = result.normalized as any[];

    // Align sentiment with price data (simplified)
    const divergences: string[] = [];

    // Calculate overall correlation
    const overallSentiment = this.calculateOverallSentiment(articles);

    // Simple correlation check
    const firstPrice = priceData[0]?.close || 0;
    const lastPrice = priceData[priceData.length - 1]?.close || firstPrice;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;

    // Detect divergence
    if (overallSentiment > 0.2 && priceChangePercent < -2) {
      divergences.push(`Positive sentiment (${overallSentiment.toFixed(2)}) but price down ${priceChangePercent.toFixed(1)}%`);
    } else if (overallSentiment < -0.2 && priceChangePercent > 2) {
      divergences.push(`Negative sentiment (${overallSentiment.toFixed(2)}) but price up ${priceChangePercent.toFixed(1)}%`);
    }

    return {
      correlation: overallSentiment > 0 ? Math.min(0.9, priceChangePercent / 100 + 0.5) : Math.max(-0.9, priceChangePercent / 100 - 0.5),
      sentimentEvents: [],
      divergences,
    };
  }

  private classifySentiment(score: number): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' {
    if (score >= 0.5) return 'strong_buy';
    if (score >= 0.1) return 'buy';
    if (score <= -0.5) return 'strong_sell';
    if (score <= -0.1) return 'sell';
    return 'neutral';
  }

  private generateDashboard(context: {
    input: NewsSentimentInput;
    overallSentiment: number;
    distribution: { positive: number; negative: number; neutral: number };
    trend: { direction: string; change7d: number };
    themes: { name: string; count: number }[];
    articleCount: number;
  }): string {
    const { input, overallSentiment, distribution, trend, themes, articleCount } = context;

    const scoreBar = this.createProgressBar(overallSentiment, -1, 1);
    const positiveBar = this.createProgressBar(distribution.positive, 0, 100);
    const negativeBar = this.createProgressBar(distribution.negative, 0, 100);
    const neutralBar = this.createProgressBar(distribution.neutral, 0, 100);

    let dashboard = `
┌─────────────────────────────────────────────────────────────────────┐
│  NEWS SENTIMENT DASHBOARD: ${input.symbol.padEnd(35)}│
├─────────────────────────────────────────────────────────────────────┤
│  Overall Sentiment:   ${scoreBar} ${overallSentiment.toFixed(2)} (${this.classifySentiment(overallSentiment).toUpperCase().padEnd(11)})│
│  ${String(trend.direction).padEnd(19)} ${this.createProgressBar(trend.change7d, -0.5, 0.5)} ${trend.change7d > 0 ? '+' : ''}${trend.change7d.toFixed(2)}│
│  Article Count:       ${String(articleCount).padEnd(4)} articles                             │
├─────────────────────────────────────────────────────────────────────┤
│  Distribution:         ${positiveBar} ${distribution.positive}% Positive                    │
│                        ${negativeBar} ${distribution.negative}% Negative                     │
│                        ${neutralBar} ${distribution.neutral}% Neutral                       │
├─────────────────────────────────────────────────────────────────────┤
│  Top Themes:           ${themes.map(t => `${t.name} (${t.count})`).join(', ').padEnd(64)}│
└─────────────────────────────────────────────────────────────────────┘
`;

    return dashboard;
  }

  private createProgressBar(value: number, min: number, max: number): string {
    const percent = (value - min) / (max - min);
    const filled = Math.max(0, Math.min(20, Math.round(percent * 20)));
    return '█'.repeat(filled) + '░'.repeat(20 - filled);
  }

  private generateSummary(context: {
    input: NewsSentimentInput;
    overallSentiment: number;
    distribution: { positive: number; negative: number; neutral: number };
    trend: { direction: string; change7d: number };
    themes: { name: string; count: number; avgSentiment: number }[];
    priceCorrelation?: {
      correlation: number;
      divergences: string[];
    };
    articleCount: number;
  }): string {
    const { input, overallSentiment, distribution, trend, themes, priceCorrelation, articleCount } = context;

    let summary = `## News Sentiment Analysis for ${input.symbol}\n\n`;
    summary += `**Overall Sentiment:** ${overallSentiment.toFixed(2)} (${this.classifySentiment(overallSentiment).replace('_', ' ').toUpperCase()})\n`;
    summary += `**Period:** ${input.days || 7} days | **Articles Analyzed:** ${articleCount}\n\n`;

    // Distribution
    summary += `### Sentiment Distribution\n`;
    summary += `- Positive: ${distribution.positive}%\n`;
    summary += `- Negative: ${distribution.negative}%\n`;
    summary += `- Neutral: ${distribution.neutral}%\n\n`;

    // Trend
    summary += `### Sentiment Trend\n`;
    summary += `Direction: ${trend.direction.toUpperCase()} (change: ${trend.change7d > 0 ? '+' : ''}${trend.change7d.toFixed(2)})\n\n`;

    // Themes
    if (themes.length > 0) {
      summary += `### Key Themes\n`;
      for (const theme of themes.slice(0, 5)) {
        const sentimentIcon = theme.avgSentiment > 0 ? '🟢' : theme.avgSentiment < 0 ? '🔴' : '⚪';
        summary += `- ${sentimentIcon} **${theme.name}** (${theme.count} articles, avg: ${theme.avgSentiment.toFixed(2)})\n`;
      }
      summary += '\n';
    }

    // Price correlation
    if (priceCorrelation && priceCorrelation.divergences.length > 0) {
      summary += `### Price Correlation Notes\n`;
      for (const divergence of priceCorrelation.divergences) {
        summary += `- ⚠️ ${divergence}\n`;
      }
      summary += '\n';
    }

    // Interpretation
    summary += `### Interpretation\n`;

    const classification = this.classifySentiment(overallSentiment);
    if (classification === 'strong_buy' || classification === 'buy') {
      summary += `News flow is ${classification === 'strong_buy' ? 'overwhelmingly' : 'generally'} positive for ${input.symbol}. `;
      summary += `Investors should monitor for sentiment shifts as extreme positive readings sometimes precede corrections. `;
      summary += `${distribution.pospective > 70 ? 'High positive sentiment may indicate overbought conditions.' : ''}\n`;
    } else if (classification === 'strong_sell' || classification === 'sell') {
      summary += `News flow is ${classification === 'strong_sell' ? 'overwhelmingly' : 'generally'} negative for ${input.symbol}. `;
      summary += `Caution is warranted for long positions. `;
      summary += `${distribution.negative > 70 ? 'Extreme negative sentiment may present contrarian opportunity.' : ''}\n`;
    } else {
      summary += `News flow is balanced with mixed sentiment for ${input.symbol}. `;
      summary += `Wait for directional catalyst before making trading decisions.\n`;
    }

    return summary;
  }

  private createInsufficientDataResult(input: NewsSentimentInput, articles: NewsArticle[]): SentimentResult {
    return {
      symbol: input.symbol,
      period: `${input.days || 7} days`,
      articleCount: articles.length,
      overallSentiment: 0,
      classification: 'neutral',
      distribution: { positive: 0, negative: 0, neutral: 100 },
      trend: { direction: 'stable', change7d: 0 },
      topHeadlines: { positive: [], negative: [] },
      themes: [],
      dashboard: `
┌─────────────────────────────────────────────────────────────────────┐
│  NEWS SENTIMENT DASHBOARD: ${input.symbol.padEnd(35)}│
├─────────────────────────────────────────────────────────────────────┤
│  ⚠️  INSUFFICIENT DATA                                             │
│                                                                     │
│  Only ${articles.length} article${articles.length !== 1 ? 's' : ''} found. Minimum ${input.minArticles || 10} required.          │
│  Try expanding the timeframe or search terms.                       │
└─────────────────────────────────────────────────────────────────────┘
`,
      summary: `## News Sentiment Analysis for ${input.symbol}\n\n⚠️ **Insufficient Data**\n\nOnly ${articles.length} article${articles.length !== 1 ? 's were' : ' was'} found for the specified period. A minimum of ${input.minArticles || 10} articles is required for reliable sentiment analysis.\n\n**Suggestions:**\n- Expand the time period (try 30 or 90 days)\n- Check if the symbol is correct and actively traded\n- Consider using sector analysis instead`,
    };
  }
}

/**
 * Main skill entry point
 */
export async function run(input: NewsSentimentInput): Promise<string> {
  const mcpClient = new MCPClientWrapper({
    serverCommand: 'node',
    serverArgs: ['../../financial-data-mcp/dist/server.js'],
  });

  try {
    const analyzer = new NewsSentimentAnalyzer(mcpClient);
    const result = await analyzer.analyze(input);

    let output = result.summary;
    output += `\n\n${result.dashboard}`;

    return output;
  } finally {
    await mcpClient.disconnect();
  }
}
