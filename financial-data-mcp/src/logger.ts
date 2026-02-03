import * as fs from 'fs';
import * as path from 'path';

/**
 * Configurable logger with level-based filtering
 * Outputs structured JSON to stderr for MCP compatibility and local file
 */

const LOG_FILE_PATH = path.join('/tmp', 'financial-data-mcp.log');

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: Record<string, unknown>;
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

function parseLogLevel(value: string | undefined): LogLevel {
  if (!value) return LogLevel.INFO;
  
  const normalized = value.toUpperCase().trim();
  switch (normalized) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
    case 'WARNING':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

export class Logger {
  private level: LogLevel;
  private readonly context?: string;

  constructor(context?: string) {
    this.level = parseLogLevel(process.env.LOG_LEVEL);
    this.context = context;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LOG_LEVEL_NAMES[level],
      message: this.context ? `[${this.context}] ${message}` : message,
    };

    if (data !== undefined) {
      entry.data = data;
    }

    const jsonEntry = JSON.stringify(entry);
    console.error(jsonEntry);

    try {
      fs.appendFileSync(LOG_FILE_PATH, jsonEntry + '\n');
    } catch (err) {
      // Ignore file write errors to prevent crashing
    }
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    const childLogger = new Logger(childContext);
    childLogger.setLevel(this.level);
    return childLogger;
  }

  isLevelEnabled(level: LogLevel): boolean {
    return level >= this.level;
  }
}

export const logger = new Logger();
