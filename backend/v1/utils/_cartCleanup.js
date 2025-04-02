import cron from 'node-cron';
import { Cart } from '../models/index.js';
import CartController from '../controllers/_cartController.js';

const cleanupExpiredCarts = () => {
    cron.schedule('*/10 * * * *', async () => {
        try {
            const now = new Date();
            const timeoutThreshold = new Date(now - 30 * 60 * 1000);
            const expiredCarts = await Cart.find({ lastUpdated: { $lt: timeoutThreshold } }).select('_id');

            for (const cart of expiredCarts) {
                await CartController.clearExpiredCart(cart._id);
            }
            console.log(`Cleared ${expiredCarts.length} expired carts`);
        } catch (err) {
            console.error('Cart cleanup error:', err);
        }
    });
};

export default cleanupExpiredCarts;
