import fs from 'fs';
import { createLogger, transports, format } from 'winston';
import expressWinston from 'express-winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = 'v1/logs';

// Ensure log directory exists, creating it if necessary
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_LEVEL = 'info';
const customTimestamp = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss A' });

/**
 * Custom log format that filters sensitive data and pretty-prints metadata.
 * Masks authorization headers and structures log output.
 * @param {Object} info - Winston log info object containing level, message, timestamp, and meta
 * @returns {string} Formatted log string
 */
const prettyPrintFormat = format.printf(({ level, message, timestamp, meta }) => {
  // const statusCode = meta?.res?.statusCode; // Commented out but preserved
  if (meta?.req?.headers?.authorization) delete meta.req.headers.authorization; // Mask sensitive data
  const metaString = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} ${level.toUpperCase()}: ${message} ${metaString}`;
});

/**
 * Winston logger instance for application logging.
 * Configures daily rotating log files for different levels and exceptions.
 * @type {Object}
 */
export const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(customTimestamp, prettyPrintFormat),
  transports: [
    // General application logs
    new DailyRotateFile({
      filename: `${LOG_DIR}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m', // Maximum file size: 20MB
      maxFiles: '14d', // Retain logs for 14 days
      level: LOG_LEVEL,
    }),
    // Error-specific logs
    new DailyRotateFile({
      filename: `${LOG_DIR}/errors-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      handleExceptions: true,
    }),
    // Debug-level logs
    new DailyRotateFile({
      filename: `${LOG_DIR}/debug-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'debug',
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: `${LOG_DIR}/exceptions.log` }) // Log uncaught exceptions
  ],
});

// Add console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(format.colorize(), customTimestamp, prettyPrintFormat),
    handleExceptions: true,
  }));
}

/**
 * Global handler for unhandled promise rejections.
 * Logs the rejection reason using the configured logger.
 */
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

/**
 * Express middleware for request/response logging.
 * Integrates with Winston logger and includes metadata.
 * @type {Function}
 */
export const appLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true, // Include request/response metadata
  statusLevels: true, // Log based on status: info (<400), error (>=400)
  expressFormat: true, // Use Express-style log format
  colorize: false,
});

/**
 * Express middleware for error logging.
 * Logs errors using the configured Winston logger instance.
 * @type {Function}
 */
export const errorLogger = expressWinston.errorLogger({ winstonInstance: logger });
