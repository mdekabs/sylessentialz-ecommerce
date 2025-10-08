import HttpStatus from "http-status-codes";
import { responseHandler } from "../utils/index.js";
import { logger } from "../config/_logger.js";

const errorMiddleware = (err, req, res, next) => {
  logger.error(`Error: ${err.message}, Stack: ${err.stack}`);
  const status = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
  const message = err.message || "Internal Server Error";
  responseHandler(res, status, "error", message, {
    error: {
      message,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    },
  });
};

export { errorMiddleware };