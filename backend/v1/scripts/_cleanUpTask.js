import "../config/_env.js";
import { logger } from "../config/_logger.js";
import cleanupExpiredCarts from "../jobs/scheduler/_cartCleanup.js";
import { connectDB, disconnectDB } from "../config/_database.js";

(async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info("✅ Connected to MongoDB - Cron Job Worker Started");

    // Start cron jobs
    cleanupExpiredCarts();

    // Graceful shutdown on exit
    process.on("SIGINT", async () => {
      logger.info("🛑 Shutting down cron worker...");
      await disconnectDB();
      process.exit(0);
    });
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
})();
