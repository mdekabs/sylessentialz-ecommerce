import { createLogger } from 'winston';
import { transports, format } from 'winston';
import expressWinston from 'express-winston';

// Constants for logger configuration
const LOG_LEVEL = 'info';
const LOG_FORMAT = format.printf(({ level, meta, message, timestamp }) => {
  return `${timestamp} ${level.toUpperCase()}: ${message} ${meta ? JSON.stringify(meta.res.statusCode) : ''}`;
});
const LOG_DIR = 'v1/logs';
const APP_LOG_FILE = `${LOG_DIR}/app.log`;
const ERROR_LOG_FILE = `${LOG_DIR}/errors.log`;

// Setup a logger
export const logger = createLogger({
  level: LOG_LEVEL,
  format: format.combine(
    format.json(),
    format.timestamp(),
    LOG_FORMAT,
  ),
  transports: [
    new transports.File({
      level: LOG_LEVEL,
      filename: APP_LOG_FILE
    }),
    new transports.File({
      level: 'error',
      filename: ERROR_LOG_FILE,
      handleExceptions: true
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new transports.Console({
    handleExceptions: true
  }));
};

// Constants for expressWinston logger options
const EXPRESS_LOGGER_OPTIONS = {
  winstonInstance: logger,
  meta: true,
  statusLevels: true,
  colorize: false,
  expressFormat: true,
};

// Setup a logger for express app
export const appLogger = expressWinston.logger(EXPRESS_LOGGER_OPTIONS);

// Constants for expressWinston error logger options
const ERROR_LOGGER_OPTIONS = {
  winstonInstance: logger
};

// Setup error logger for express app
export const errorLogger = expressWinston.errorLogger(ERROR_LOGGER_OPTIONS);
