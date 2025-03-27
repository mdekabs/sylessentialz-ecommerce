import redisClient from "../redis.js";
import { responseHandler } from "../utils/index.js";
import HttpStatus from "http-status-codes";

// Middleware to cache GET requests
export const cacheMiddleware = async (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  const key = req.originalUrl;
  const TTL = 300; // Cache expiration time in seconds

  try {
    // Fetch cached response
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);

      // Prevent serving cached error responses
      if (parsedData.type === "error") {
        await redisClient.del(key); // Remove cached error
      } else {
        return res.json(parsedData);
      }
    }

    // Store only valid 2xx responses in cache
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(key, JSON.stringify(body), "EX", TTL);
      }
      originalJson(body);
    };

    next();
  } catch (error) {
    console.error(`⚠️ Cache Error: ${error.message}`);
    return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Cache error");
  }
};

// Middleware to clear cache for a specific key derived from the request
export const clearCache = async (req, res, next) => {
  try {
    // Derive the cache key from the request (e.g., originalUrl or a custom key)
    const key = req.originalUrl || req.path; // Fallback to req.path if originalUrl is unavailable

    // Validate the key
    if (!key || typeof key !== "string") {
      console.error(`Invalid cache key derived from request: ${key}`);
      return next(); // Proceed without crashing
    }

    // Clear the cache
    await redisClient.del(key);
    console.log(`Cache cleared for key: ${key}`);
  } catch (error) {
    console.error(`⚠️ ERROR CLEARING CACHE: ${error.message}`);
    // Don't block the request flow; log the error and proceed
  }
  next(); // Always call next() to continue the request chain
};
