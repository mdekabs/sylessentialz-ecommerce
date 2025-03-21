import redisClient from "../redis.js";
import { responseHandler } from "../utils/index.js";
import HttpStatus from "http-status-codes";

export const cacheMiddleware = async (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  const key = req.originalUrl;
  const TTL = 300;

  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      return res.json(JSON.parse(cachedData));
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(key, JSON.stringify(body), "EX", TTL);
      }
      originalJson(body);
    };

    next();
  } catch (error) {
    return responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Cache error");
  }
};

export const clearCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error(`⚠️ ERROR CLEARING CACHE: ${error.message}`);
  }
};
