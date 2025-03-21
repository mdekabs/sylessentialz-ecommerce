import redisClient from "../redis.js";
import { logger } from "../config/logger.js";

export const cacheMiddleware = async (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }

  const key = req.originalUrl;
  const TTL = 300;

  try {
    const cachedData = await redisClient.get(key);
    if (cachedData) {
      logger.info(`✅ CACHE HIT: ${key}`);
      return res.json(JSON.parse(cachedData));
    }

    logger.info(`❌ CACHE MISS: ${key}`);

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(key, JSON.stringify(body), "EX", TTL);
        logger.info(`🗄️ CACHE SET: ${key} (TTL: ${TTL}s)`);
      }
      originalJson(body);
    };

    next();
  } catch (error) {
    logger.error(`⚠️ CACHE ERROR: ${error.message}`);
    next();
  }
};

export const clearCache = async (key) => {
  try {
    await redisClient.del(key);
    logger.info(`🗑️ CACHE CLEARED: ${key}`);
  } catch (error) {
    logger.error(`⚠️ ERROR CLEARING CACHE: ${error.message}`);
  }
};
