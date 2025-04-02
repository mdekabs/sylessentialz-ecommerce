import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import redisClient from '../redis.js';
import { responseHandler } from '../utils/index.js';
import HttpStatus from 'http-status-codes';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const ERR_AUTH_HEADER_MISSING = "You are not authenticated. Please log in to get a new token.";
const ERR_TOKEN_NOT_FOUND = "Token not found.";
const ERR_INVALID_TOKEN = "Invalid token. Please log in again to get a new token.";
const ERR_FORBIDDEN_ACTION = "You are not allowed to perform this task.";

export const isTokenBlacklisted = async (token) => {
    const blacklisted = await redisClient.get(token);
    return blacklisted === "true";
};

export const updateBlacklist = async (token, expiration = 3600) => {
    await redisClient.set(token, "true", "EX", expiration);
};

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

export const optionalVerifier = async (req, res, next) => {
    const token = req.headers.authorization;

    if (!token) {
        req.user = null;
        return next();
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
        console.error("Optional token verification failed:", err);
        return responseHandler(res, HttpStatus.UNAUTHORIZED, "error", ERR_INVALID_TOKEN);
    }
};

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
    (user, userId) => user.id === userId,
    (user) => user.isAdmin
);

// Renamed from adminVerifier to isAdminVerifier
export const isAdminVerifier = permissionVerifier((user) => user.isAdmin);
