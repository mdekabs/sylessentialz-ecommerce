import { createClient } from "redis";
import dotenv from "dotenv";
import { logger } from "./_logger.js";

// Load environment variables
dotenv.config();

// Redis connection URL from environment variables
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create Redis client
const redisClient = createClient({
  url: REDIS_URL,
});

// Handle Redis client errors
redisClient.on("error", (err) => {
  logger.error(`Redis Client Error: ${err.message}`);
});

// Connect to Redis
async function connectRedis() {
  try {
    await redisClient.connect();
    logger.info("Connected to Redis successfully");
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error.message}`);
    throw new Error(`Redis connection failed: ${error.message}`);
  }
}

// Disconnect from Redis
async function disconnectRedis() {
  try {
    await redisClient.quit();
    logger.info("Redis connection closed");
  } catch (error) {
    logger.error(`Failed to close Redis connection: ${error.message}`);
    throw new Error(`Failed to close Redis connection: ${error.message}`);
  }
}

// Connect on initialization
connectRedis();

export default redisClient;
export { connectRedis, disconnectRedis };