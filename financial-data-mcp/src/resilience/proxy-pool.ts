import { logger } from '../logger.js';

export interface ProxyConfig {
  url: string;
  protocol?: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string;
  weight?: number;
  lastUsed?: number;
  failureCount?: number;
  inCooldown?: boolean;
  cooldownUntil?: number;
}

export interface ProxyPoolConfig {
  proxies?: string[];
  cooldownMs?: number;
  maxFailures?: number;
  rotationStrategy?: 'round-robin' | 'random' | 'weighted';
}

const DEFAULT_COOLDOWN_MS = 60000;
const DEFAULT_MAX_FAILURES = 3;

export class ProxyPool {
  private proxies: ProxyConfig[] = [];
  private currentIndex: number = 0;
  private readonly cooldownMs: number;
  private readonly maxFailures: number;
  private readonly rotationStrategy: 'round-robin' | 'random' | 'weighted';

  constructor(config?: ProxyPoolConfig) {
    this.cooldownMs = config?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.maxFailures = config?.maxFailures ?? DEFAULT_MAX_FAILURES;
    this.rotationStrategy = config?.rotationStrategy ?? 'round-robin';

    if (config?.proxies) {
      this.addProxies(config.proxies);
    }

    this.loadFromEnv();
  }

  private loadFromEnv(): void {
    const envProxies = process.env.PROXY_POOL;
    if (envProxies) {
      const proxyList = envProxies.split(',').map(p => p.trim()).filter(Boolean);
      this.addProxies(proxyList);
    }
  }

  addProxies(proxyUrls: string[]): void {
    for (const url of proxyUrls) {
      if (!this.proxies.find(p => p.url === url)) {
        this.proxies.push({
          url,
          weight: 1,
          failureCount: 0,
          inCooldown: false,
        });
      }
    }
    logger.debug('Proxy pool updated', { count: this.proxies.length });
  }

  getNextProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      return null;
    }

    const now = Date.now();
    
    for (const proxy of this.proxies) {
      if (proxy.inCooldown && proxy.cooldownUntil && proxy.cooldownUntil <= now) {
        proxy.inCooldown = false;
        proxy.failureCount = 0;
        logger.debug('Proxy cooldown expired', { url: proxy.url });
      }
    }

    const available = this.proxies.filter(p => !p.inCooldown);
    
    if (available.length === 0) {
      logger.warn('All proxies in cooldown');
      return null;
    }

    let selected: ProxyConfig;

    switch (this.rotationStrategy) {
      case 'random':
        selected = available[Math.floor(Math.random() * available.length)];
        break;
      case 'weighted':
        const totalWeight = available.reduce((sum, p) => sum + (p.weight ?? 1), 0);
        let random = Math.random() * totalWeight;
        selected = available[0];
        for (const proxy of available) {
          random -= proxy.weight ?? 1;
          if (random <= 0) {
            selected = proxy;
            break;
          }
        }
        break;
      case 'round-robin':
      default:
        this.currentIndex = this.currentIndex % available.length;
        selected = available[this.currentIndex];
        this.currentIndex++;
        break;
    }

    selected.lastUsed = now;
    return selected;
  }

  markSuccess(proxyUrl: string): void {
    const proxy = this.proxies.find(p => p.url === proxyUrl);
    if (proxy) {
      proxy.failureCount = 0;
      proxy.weight = Math.min((proxy.weight ?? 1) + 0.1, 2);
    }
  }

  markFailure(proxyUrl: string): void {
    const proxy = this.proxies.find(p => p.url === proxyUrl);
    if (proxy) {
      proxy.failureCount = (proxy.failureCount ?? 0) + 1;
      proxy.weight = Math.max((proxy.weight ?? 1) - 0.2, 0.1);

      if (proxy.failureCount >= this.maxFailures) {
        proxy.inCooldown = true;
        proxy.cooldownUntil = Date.now() + this.cooldownMs;
        logger.warn('Proxy put in cooldown', { url: proxyUrl, failures: proxy.failureCount });
      }
    }
  }

  hasAvailableProxy(): boolean {
    const now = Date.now();
    return this.proxies.some(p => !p.inCooldown || (p.cooldownUntil && p.cooldownUntil <= now));
  }

  getProxyCount(): number {
    return this.proxies.length;
  }

  getAvailableCount(): number {
    const now = Date.now();
    return this.proxies.filter(p => !p.inCooldown || (p.cooldownUntil && p.cooldownUntil <= now)).length;
  }

  clear(): void {
    this.proxies = [];
    this.currentIndex = 0;
  }
}

export const proxyPool = new ProxyPool();
