import "dotenv/config";
import Queue from "bull";
import { logger } from "../../config/logger.js";

/**
 * Bull queue instance for processing email jobs.
 * Connects to Redis using environment variables for configuration.
 * @type {Queue}
 */
const emailQueue = new Queue("emailQueue", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
  },
});

// Log queue connection events
emailQueue.on("ready", () => {
  logger.info("Email queue connected to Redis");
});

emailQueue.on("error", (error) => {
  logger.error(`Email queue error: ${error.message}`);
});

export { emailQueue };