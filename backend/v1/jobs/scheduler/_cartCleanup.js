import cron from "node-cron";
import { Cart } from "../../models/index.js";
import CartController from "../../services/_cartService.js";
import { logger } from "../../config/_logger.js";

/**
 * Schedules a cron job to clean up expired carts.
 * Runs every 10 minutes to remove carts inactive for over 30 minutes.
 * @returns {void}
 */
const cleanupExpiredCarts = () => {
  // Schedule task to run every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    // Cron pattern: every 10th minute
    try {
      const now = new Date(); // Current timestamp
      const timeoutThreshold = new Date(now - 30 * 60 * 1000); // 30 minutes ago
      // Find carts not updated in the last 30 minutes
      const expiredCarts = await Cart.find({
        lastUpdated: { $lt: timeoutThreshold }, // Less than threshold
      }).select("_id"); // Only fetch cart IDs

      // Clear each expired cart using the controller
      for (const cart of expiredCarts) {
        await CartController.clearExpiredCart(cart._id); // Delegate cleanup to controller
      }
      logger.info(`Cleared ${expiredCarts.length} expired carts`);
    } catch (err) {
      logger.error(`Cart cleanup error: ${err.message}`);
    }
  });
};

export default cleanupExpiredCarts;