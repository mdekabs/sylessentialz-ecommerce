import "./config/_env.js";
import app from "./app.js";
import { connectDB, disconnectDB } from "./config/_database.js";
import { connectRedis, disconnectRedis } from "./config/_redis.js";
import { logger } from "./config/_logger.js";
import gracefulShutdown from "express-graceful-shutdown";

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB();
    await connectRedis();

    // Create HTTP server with graceful shutdown
    const server = app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });

    // Apply graceful shutdown middleware
    app.use(gracefulShutdown(server, {
      timeout: 30000, // Wait up to 30 seconds for connections to close
      logger: logger.info.bind(logger), // Log shutdown messages using Winston
    }));

  } catch (error) {
    logger.error(`Server startup error: ${error.message}`);
    process.exit(1);
  }
};

const shutdown = async (signal) => {
  try {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    // Close Express server (handled by express-graceful-shutdown middleware)
    // Note: gracefulShutdown middleware automatically closes the server when SIGINT/SIGTERM is received

    // Disconnect MongoDB
    await disconnectDB();
    logger.info("MongoDB disconnected");

    // Disconnect Redis
    await disconnectRedis();
    logger.info("Redis disconnected");

    logger.info("Graceful shutdown completed.");
    process.exit(0);
  } catch (error) {
    logger.error(`Shutdown error: ${error.message}`);
    process.exit(1);
  }
};

// Handle termination signals
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();