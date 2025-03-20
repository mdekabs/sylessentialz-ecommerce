import fs from 'fs';
import { createLogger, transports, format } from 'winston';
import expressWinston from 'express-winston';

// Ensure logs directory exists
const LOG_DIR = 'v1/logs';
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Constants for logger configuration
const LOG_LEVEL = 'info';
const APP_LOG_FILE = `${LOG_DIR}/app.log`;
const ERROR_LOG_FILE = `${LOG_DIR}/errors.log`;

// Define custom timestamp format
const customTimestamp = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss A' });

// Define log format
const LOG_FORMAT = format.printf(({ level, message, timestamp, meta }) => {
  const statusCode = meta?.res?.statusCode || 'N/A';
  return `${timestamp} ${level.toUpperCase()}: ${message} (Status: ${statusCode})`;
});

// Create Winston logger
export const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(customTimestamp, LOG_FORMAT),
  transports: [
    new transports.File({ level: LOG_LEVEL, filename: APP_LOG_FILE }),
    new transports.File({ level: 'error', filename: ERROR_LOG_FILE, handleExceptions: true }),
  ],
});

// Add console transport for development mode
if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(format.colorize(), format.simple()),
    handleExceptions: true,
  }));
}

// Express request logger middleware
export const appLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  statusLevels: true,
  expressFormat: true,
  colorize: false,
});

// Express error logger middleware
export const errorLogger = expressWinston.errorLogger({ winstonInstance: logger });
