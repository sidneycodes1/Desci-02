export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  scope?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(error: Error | string, context?: LogContext): void;
  child(scope: string): Logger;
}

function serializeContext(level: LogLevel, message: string, context?: LogContext) {
  return JSON.stringify({
    level,
    message,
    scope: context?.scope,
    tags: context?.tags,
    metadata: context?.metadata,
    timestamp: new Date().toISOString()
  });
}

function log(level: LogLevel, message: string, context?: LogContext) {
  const payload = serializeContext(level, message, context);

  if (level === 'error') {
    console.error(payload);
    return;
  }

  if (level === 'warn') {
    console.warn(payload);
    return;
  }

  if (level === 'debug') {
    console.debug(payload);
    return;
  }

  console.info(payload);
}

export function createLogger(scope = 'app'): Logger {
  return {
    debug(message, context) {
      log('debug', message, { scope, ...context });
    },
    info(message, context) {
      log('info', message, { scope, ...context });
    },
    warn(message, context) {
      log('warn', message, { scope, ...context });
    },
    error(error, context) {
      log('error', error instanceof Error ? error.message : error, {
        scope,
        ...context,
        metadata: {
          ...(context?.metadata ?? {}),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    },
    child(childScope) {
      return createLogger(`${scope}:${childScope}`);
    }
  };
}

export const logger = createLogger();
