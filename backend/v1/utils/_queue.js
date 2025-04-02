import "dotenv/config"; // Loads environment variables from .env file
import Queue from "bull";

/**
 * Bull queue instance for processing email jobs.
 * Connects to Redis using environment variables for configuration.
 * @type {Queue}
 */
const emailQueue = new Queue("emailQueue", {
    redis: {
        host: process.env.REDIS_HOST, // Redis server hostname from env
        port: process.env.REDIS_PORT  // Redis server port from env
    }
});

export { emailQueue };
