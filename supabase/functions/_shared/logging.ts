/**
 * RetailX V2 — Edge Function shared logging
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  userId?: string;
  functionName?: string;
  [key: string]: unknown;
}

export function createLogger(functionName: string, baseContext: LogContext = {}) {
  const log = (level: LogLevel, message: string, context: LogContext = {}) => {
    const entry = {
      ts: new Date().toISOString(),
      level,
      function: functionName,
      message,
      ...baseContext,
      ...context,
    };
    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  };

  return {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext) => log('error', message, context),
  };
}

export function generateRequestId(): string {
  return crypto.randomUUID();
}
