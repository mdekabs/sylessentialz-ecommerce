import redisClient from "../redis.js";
import { responseHandler } from "../utils/index.js";
import HttpStatus from "http-status-codes";

/**
 * Middleware to cache successful GET request responses in Redis.
 * Only caches 2xx responses and skips caching for errors or non-GET requests.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const cacheMiddleware = async (req, res, next) => {
  if (req.method !== "GET") {
    return next(); // Skip caching for non-GET requests
  }

  const key = req.originalUrl;
  const TTL = 300; // Cache expiration time in seconds (5 minutes)

  try {
    // Attempt to fetch cached response from Redis
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);

      // Prevent serving cached error responses
      if (parsedData.type === "error") {
        await redisClient.del(key); // Remove invalid cached error
      } else {
        return res.json(parsedData); // Serve cached data
      }
    }

    // Override res.json to cache only successful 2xx responses
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(key, JSON.stringify(body), "EX", TTL);
      }
      return originalJson(body); // Ensure response is sent
    };

    next();
  } catch (error) {
    console.error(`⚠️ Cache Error: ${error.message}`);
    return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Cache error");
  }
};

/**
 * Middleware to clear Redis cache for a specific key derived from the request.
 * Clears related cache keys as well.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Promise<void>}
 */
export const clearCache = async (req, res, next) => {
  try {
    // Derive cache key from request URL, falling back to path if needed
    const key = req.originalUrl || req.path;
    console.log(`Attempting to clear cache for key: ${key}`);

    if (!key || typeof key !== "string") {
      console.error(`Invalid cache key derived from request: ${key}`);
      return next(); // Skip cache clearing and proceed
    }

    // Clear exact key
    await redisClient.del(key);

    // Clear all variations of the key
    const wildcardKey = key.includes("/") ? key.split("/")[1] : key;
    const keysToDelete = await redisClient.keys(`*${wildcardKey}*`);
    
    if (keysToDelete.length) {
      await redisClient.del(...keysToDelete);
      console.log(`Cleared related cache keys: ${keysToDelete}`);
    }

  } catch (error) {
    console.error(`⚠️ ERROR CLEARING CACHE: ${error.message}`);
  }
  next(); // Always proceed to next middleware
};
