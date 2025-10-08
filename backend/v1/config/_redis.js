import { createClient } from "redis";
import { logger } from "./_logger.js";

const redisClient = createClient({
  url: process.env.REDIS_URI,
});

const connectRedis = async () => {
  try {
    if (redisClient.isOpen) {
      logger.info("Redis client already connected");
      return;
    }
    await redisClient.connect();
    logger.info("Redis connected");
  } catch (error) {
    logger.error(`Redis connection error: ${error.message}`);
    throw error;
  }
};

const disconnectRedis = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      logger.info("Redis disconnected");
    } else {
      logger.info("Redis client already disconnected");
    }
  } catch (error) {
    logger.error(`Redis disconnection error: ${error.message}`);
    throw error;
  }
};

export default redisClient;
export { connectRedis, disconnectRedis };