import 'server-only';
import winston from 'winston';

export interface ILoggerMeta {
  service: string;
  timestamp?: string;
  meta?: unknown;
}

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.splat(),
    winston.format.metadata(),
    winston.format.printf((info) => {
      const { level, message, metadata } = info as typeof info & { metadata: ILoggerMeta };
      const { meta, service, timestamp } = metadata;
      const metaString = meta && Object.keys(meta).length > 0 ? JSON.stringify(meta, null, 2) : '';
      return `[${service}] [${timestamp}] [${level}]: ${message} ${metaString}`;
    }),
  ),
});

class WinstonLogger {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transports: [consoleTransport],
      defaultMeta: { service: 'kambriq-web' },
    });
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, { meta });
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, { meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, { meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.logger.error(message, { meta });
  }

  http(message: string, meta?: Record<string, unknown>): void {
    this.logger.http(message, { meta });
  }
}

export const logger = new WinstonLogger();
