import fs from 'fs';
import { createLogger, transports, format } from 'winston';
import expressWinston from 'express-winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const LOG_DIR = 'v1/logs';
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_LEVEL = 'info';
const customTimestamp = format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss A' });

// Custom format with filtered metadata
const prettyPrintFormat = format.printf(({ level, message, timestamp, meta }) => {
 // const statusCode = meta?.res?.statusCode;
  if (meta?.req?.headers?.authorization) delete meta.req.headers.authorization; // Mask sensitive data
  const metaString = meta ? `\n${JSON.stringify(meta, null, 2)}` : '';
  return `${timestamp} ${level.toUpperCase()}: ${message} ${metaString}`;
});

export const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(customTimestamp, prettyPrintFormat),
  transports: [
    new DailyRotateFile({
      filename: `${LOG_DIR}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: LOG_LEVEL,
    }),
    new DailyRotateFile({
      filename: `${LOG_DIR}/errors-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      handleExceptions: true,
    }),
    new DailyRotateFile({
      filename: `${LOG_DIR}/debug-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'debug',
    }),
  ],
  exceptionHandlers: [
    new transports.File({ filename: `${LOG_DIR}/exceptions.log` })
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    format: format.combine(format.colorize(), customTimestamp, prettyPrintFormat),
    handleExceptions: true,
  }));
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

export const appLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true, // Include request/response metadata
  statusLevels: true, // Log based on status (info for <400, error for >=400)
  expressFormat: true, // Use Express-style log format
  colorize: false,
});

export const errorLogger = expressWinston.errorLogger({ winstonInstance: logger });
