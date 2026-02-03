/**
 * API key rotation with round-robin selection
 * Manages multiple API keys per provider with cooldown tracking
 */

import type { ResilienceConfig, ApiKeyInfo, KeyRotationEvent, ApiSource } from '../types.js';
import { logger } from '../logger.js';

const ENV_VAR_MAP: Record<ApiSource, string> = {
  'finnhub': 'FINNHUB_API_KEY',
  'alphavantage': 'ALPHAVANTAGE_API_KEY',
  'twelvedata': 'TWELVEDATA_API_KEY',
  'tiingo': 'TIINGO_API_KEY',
};

export class KeyManager {
  private keys: Map<string, ApiKeyInfo[]> = new Map();
  private currentIndexes: Map<string, number> = new Map();
  private readonly config: ResilienceConfig;
  private readonly apiName: string;

  constructor(apiName: string, config: ResilienceConfig) {
    this.apiName = apiName;
    this.config = config;
    this.initializeKeys(apiName);
  }

  private initializeKeys(apiName: string): void {
    const envVar = ENV_VAR_MAP[apiName as ApiSource];
    if (!envVar) {
      logger.warn(`Unknown API source: ${apiName}`);
      return;
    }
    
    const keyEnv = process.env[envVar];

    if (!keyEnv || !keyEnv.trim()) {
      logger.warn(`No API keys configured for ${apiName}`);
      return;
    }

    if (keyEnv.includes(',')) {
      const keyArray = keyEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
      this.keys.set(apiName, keyArray.map((key, index) => ({
        key,
        index,
        usageCount: 0,
        lastUsed: 0,
        inCooldown: false
      })));
      this.currentIndexes.set(apiName, 0);
      logger.debug(`Initialized ${keyArray.length} keys for ${apiName}`, { 
        apiName, 
        keyCount: keyArray.length 
      });
    } else {
      this.keys.set(apiName, [{
        key: keyEnv.trim(),
        index: 0,
        usageCount: 0,
        lastUsed: 0,
        inCooldown: false
      }]);
      this.currentIndexes.set(apiName, 0);
      logger.debug(`Using single key for ${apiName}`, { apiName, keyCount: 1 });
    }
  }

  getNextKey(apiName: string): ApiKeyInfo | null {
    const keys = this.keys.get(apiName);
    if (!keys || keys.length === 0) {
      return null;
    }

    let currentIndex = this.currentIndexes.get(apiName) || 0;
    const maxAttempts = keys.length * 2;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const key = keys[currentIndex];

      if (!key.inCooldown) {
        this.currentIndexes.set(apiName, currentIndex);
        return { ...key };
      }

      currentIndex = (currentIndex + 1) % keys.length;
    }

    logger.warn(`All keys for ${apiName} are in cooldown`);
    return null;
  }

  markRateLimit(keyIndex: number): void {
    const keys = this.keys.get(this.apiName);
    if (!keys || keyIndex >= keys.length) {
      return;
    }

    const key = keys[keyIndex];
    key.inCooldown = true;
    key.cooldownUntil = Date.now() + this.config.keyRotationResetWindowMs;
    key.lastRateLimitError = Date.now();
    
    logger.debug(`Rate limit hit, key entering cooldown`, {
      apiName: this.apiName,
      keyIndex,
      cooldownMs: this.config.keyRotationResetWindowMs,
    });
    
    this.logEvent('KEY_RATE_LIMITED', `Rate limit hit for key index ${keyIndex}`, keyIndex);
  }

  recordUsage(keyIndex: number): void {
    const keys = this.keys.get(this.apiName);
    if (!keys || keyIndex >= keys.length) {
      return;
    }

    const key = keys[keyIndex];
    key.usageCount++;
    key.lastUsed = Date.now();
    this.currentIndexes.set(this.apiName, keyIndex);
  }

  resetCooldown(keyIndex: number): void {
    const keys = this.keys.get(this.apiName);
    if (!keys || keyIndex >= keys.length) {
      return;
    }

    const key = keys[keyIndex];
    key.inCooldown = false;
    key.cooldownUntil = undefined;
    this.logEvent('KEY_ROTATION_READY', `Cooldown reset for key index ${keyIndex}`, keyIndex);
  }

  checkAndResetCooldowns(): void {
    const now = Date.now();
    const keys = this.keys.get(this.apiName);

    if (!keys) {
      return;
    }

    let hasReset = false;

    keys.forEach((key, index) => {
      if (key.inCooldown && key.cooldownUntil && now >= key.cooldownUntil) {
        this.resetCooldown(index);
        hasReset = true;
      }
    });

    if (hasReset) {
      logger.debug(`Reset cooldown for ${this.apiName} keys`);
    }
  }

  getKeyInfo(apiName: string): ApiKeyInfo[] {
    return this.keys.get(apiName) || [];
  }

  getCurrentKeyIndex(apiName: string): number {
    return this.currentIndexes.get(apiName) || 0;
  }

  getAvailableKeyCount(): number {
    const keys = this.keys.get(this.apiName);
    if (!keys) return 0;
    return keys.filter(k => !k.inCooldown).length;
  }

  getTotalKeyCount(): number {
    const keys = this.keys.get(this.apiName);
    return keys ? keys.length : 0;
  }

  hasAvailableKey(): boolean {
    this.checkAndResetCooldowns();
    return this.getAvailableKeyCount() > 0;
  }

  rotateKey(): boolean {
    const keys = this.keys.get(this.apiName);
    if (!keys || keys.length <= 1) return false;

    let currentIndex = this.currentIndexes.get(this.apiName) || 0;
    const startIndex = currentIndex;

    do {
      currentIndex = (currentIndex + 1) % keys.length;
      if (!keys[currentIndex].inCooldown) {
        this.currentIndexes.set(this.apiName, currentIndex);
        logger.debug(`Rotated to key index ${currentIndex}`, {
          apiName: this.apiName,
          keyIndex: currentIndex,
        });
        this.logEvent('KEY_ROTATED', `Rotated to key index ${currentIndex}`, currentIndex);
        return true;
      }
    } while (currentIndex !== startIndex);

    logger.warn(`No available key to rotate to for ${this.apiName}`);
    return false;
  }

  getCurrentKey(): string | null {
    const keys = this.keys.get(this.apiName);
    if (!keys || keys.length === 0) return null;
    
    const currentIndex = this.currentIndexes.get(this.apiName) || 0;
    return keys[currentIndex]?.key || null;
  }

  private logEvent(event: KeyRotationEvent['event'], reason: string, keyIndex?: number): void {
    const logEntry: KeyRotationEvent = {
      event,
      api: this.apiName,
      keyIndex: keyIndex || 0,
      reason,
      timestamp: new Date().toISOString()
    };
    console.error(JSON.stringify(logEntry));
  }
}
