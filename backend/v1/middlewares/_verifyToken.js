import jwt from "jsonwebtoken";
import redisClient from "../config/_redis.js";
import { responseHandler } from "../utils/index.js";
import HttpStatus from "http-status-codes";
import { logger } from "../config/_logger.js";

const JWT_SECRET = process.env.JWT_SECRET;

// Error message constants
const ERR_AUTH_HEADER_MISSING = "You are not authenticated. Please log in to get a new token.";
const ERR_TOKEN_NOT_FOUND = "Token not found.";
const ERR_INVALID_TOKEN = "Invalid token. Please log in again to get a new token.";
const ERR_FORBIDDEN_ACTION = "You are not allowed to perform this task.";

/**
 * Checks if a token is blacklisted in Redis.
 * @param {string} token - The JWT token to check
 * @returns {Promise<boolean>} True if token is blacklisted, false otherwise
 */
export const isTokenBlacklisted = async (token) => {
  const blacklisted = await redisClient.get(`blacklist:${token}`);
  return blacklisted === "true";
};

/**
 * Adds a token to the Redis blacklist with an expiration time.
 * @param {string} token - The JWT token to blacklist
 * @param {number} [expiration=3600] - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<void>}
 */
export const updateBlacklist = async (token, expiration = 3600) => {
  await redisClient.set(`blacklist:${token}`, "true", "EX", expiration);
  logger.info(`Token blacklisted for ${expiration}s`);
};

/**
 * Middleware to verify JWT authentication for protected routes.
 */
export const authenticationVerifier = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1]; // Bearer <token>
  if (!token) {
    return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_AUTH_HEADER_MISSING);
  }

  try {
    if (!redisClient.isOpen) {
      throw new Error("Redis client is not initialized.");
    }

    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_INVALID_TOKEN);
    }

    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    logger.error(`Token verification failed: ${err.message}`);
    return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_INVALID_TOKEN);
  }
};

/**
 * Optional authentication middleware that allows unauthenticated access.
 */
export const optionalVerifier = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_INVALID_TOKEN);
    }

    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    logger.error(`Optional token verification failed: ${err.message}`);
    return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_INVALID_TOKEN);
  }
};

/**
 * Creates a permission verification middleware with custom conditions.
 */
export const permissionVerifier = (...conditions) => {
  return (req, res, next) => {
    authenticationVerifier(req, res, () => {
      if (conditions.some((condition) => condition(req.user, req.params.userId))) {
        next();
      } else {
        responseHandler(res, HttpStatus.FORBIDDEN, "error", ERR_FORBIDDEN_ACTION);
      }
    });
  };
};

export const accessLevelVerifier = permissionVerifier(
  (user, userId) => user.id === userId, // User is accessing their own data
  (user) => user.isAdmin // User is an admin
);

export const isAdminVerifier = permissionVerifier((user) => user.isAdmin);