import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import redisClient from "../redis.js"; 
import { responseHandler } from "../utils/index.js";
import HttpStatus from "http-status-codes";

dotenv.config();

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Error messages
const ERR_AUTH_HEADER_MISSING = "You are not authenticated. Please log in to get a new token.";
const ERR_TOKEN_NOT_FOUND = "Token not found.";
const ERR_INVALID_TOKEN = "Invalid token. Please log in again to get a new token.";
const ERR_FORBIDDEN_ACTION = "You are not allowed to perform this task.";

/**
 * Checks if a token is blacklisted.
 * @param {String} token - The user token.
 * @returns {Promise<Boolean>} - True if the token is blacklisted, false otherwise.
 */
export const isTokenBlacklisted = async (token) => {
    const blacklisted = await redisClient.get(token);
    return blacklisted === "true";
};

/**
 * Adds a token to the blacklist with an expiration time.
 * @param {String} token - User token.
 * @param {Number} expiration - Expiration time in seconds (default: 1 hour).
 */
export const updateBlacklist = async (token, expiration = 3600) => {
    await redisClient.set(token, "true", "EX", expiration);
};

/**
 * JWT token verification middleware.
 */
export const authenticationVerifier = async (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
        return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_AUTH_HEADER_MISSING);
    }

    try {
        if (!redisClient) {
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
        console.error("Token verification failed:", err);
        return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_INVALID_TOKEN);
    }
};

/**
 * Permission verification middleware with closures for cleaner logic.
 * This middleware can be configured to check for different permission levels.
 * @param {Array<Function>} conditions - An array of condition functions to check against.
 * @returns {Function} - Middleware function.
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

/**
 * Verifies if the user has access to the specific user ID or is an admin.
 */
export const accessLevelVerifier = permissionVerifier(
    (user, userId) => user.id === userId,
    (user) => user.isAdmin
);

/**
 * Verifies if the user is an admin.
 */
export const isAdminVerifier = permissionVerifier((user) => user.isAdmin);
