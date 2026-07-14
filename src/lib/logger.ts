import { createLogger, format, transports } from 'winston';
import path from 'path';

const { combine, timestamp, errors, json, colorize, printf } = format;

const isProduction = process.env.NODE_ENV === 'production';

// Console format for local dev — human-readable, colorized
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${stack ? '\n' + stack : ''}${metaStr}`;
  })
);

// JSON format for production — structured, machine-parseable (Sentry/Datadog friendly)
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

const loggerTransports: transports.StreamTransportInstance[] = [
  new transports.Console({
    format: isProduction ? prodFormat : devFormat
  })
];

// Write persistent log files in production
if (isProduction) {
  loggerTransports.push(
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: prodFormat,
      maxsize: 5 * 1024 * 1024,  // 5MB
      maxFiles: 5
    }),
    new transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: prodFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  );
}

export const logger = createLogger({
  level: isProduction ? 'info' : 'debug',
  defaultMeta: { service: 'bucketdev-api' },
  transports: loggerTransports,
  exceptionHandlers: isProduction
    ? [new transports.File({ filename: path.join(process.cwd(), 'logs', 'exceptions.log') })]
    : [],
  rejectionHandlers: isProduction
    ? [new transports.File({ filename: path.join(process.cwd(), 'logs', 'rejections.log') })]
    : []
});

/**
 * Logs an API error with structured context for easy filtering in Sentry/Datadog.
 */
export function logApiError(route: string, error: unknown, extra?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('API route error', {
    route,
    message: err.message,
    stack: err.stack,
    ...extra
  });
}

export default logger;
