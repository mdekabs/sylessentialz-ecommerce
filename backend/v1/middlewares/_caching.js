import redisClient from "../redis.js";
import { responseHandler } from "../utils/index.js";
import HttpStatus from "http-status-codes";

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

// Function to manually clear cache for a specific key
export const clearCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error(`⚠️ ERROR CLEARING CACHE: ${error.message}`);
  }
};
