/**
 * Minimal structured logger.
 * Uses console in development; swap for Winston/Pino in production as needed.
 */

const isDev = process.env.NODE_ENV !== 'production';

function timestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: string, message: string, meta?: unknown): string {
  const base = `[${timestamp()}] [${level}] ${message}`;
  if (meta) {
    const metaStr = meta instanceof Error ? meta.stack : JSON.stringify(meta, null, 2);
    return `${base}\n${metaStr}`;
  }
  return base;
}

export const logger = {
  info(message: string, meta?: unknown): void {
    console.info(formatMessage('INFO', message, meta));
  },

  warn(message: string, meta?: unknown): void {
    console.warn(formatMessage('WARN', message, meta));
  },

  error(message: string, meta?: unknown): void {
    console.error(formatMessage('ERROR', message, meta));
  },

  debug(message: string, meta?: unknown): void {
    if (isDev) {
      console.debug(formatMessage('DEBUG', message, meta));
    }
  },
};
