export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export function log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : '';
  console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`);
}

export function debug(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.DEBUG, message, context);
}

export function info(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.INFO, message, context);
}

export function warn(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.WARN, message, context);
}

export function error(message: string, context?: Record<string, unknown>): void {
  log(LogLevel.ERROR, message, context);
}
