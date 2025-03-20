import HttpStatus from 'http-status-codes';
import Order from "../models/_order.js";
import StoreCredit from "../models/_storeCredit.js";
import Product from "../models/_product.js";
import Cart from "../models/_cart.js";
import { responseHandler } from '../utils/index.js';

const STORE_CREDIT_EXPIRY = new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000);

const orderController = {
  // Create a new order
  create_order: async (req, res) => {
    try {
      const userId = req.user.id;
      const { address } = req.body;

      // Fetch user's cart
      const cart = await Cart.findOne({ userId });
      if (!cart || cart.products.length === 0) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Your cart is empty.');
      }

      let orderTotal = 0;
      let orderedProducts = [];

      for (const cartItem of cart.products) {
        const product = await Product.findById(cartItem.productId);
        if (!product) {
          return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', `Product not found: ${cartItem.productId}`);
        }
        orderTotal += product.price * cartItem.quantity;
        orderedProducts.push({ productId: cartItem.productId, quantity: cartItem.quantity });
      }

      const fixedShippingFee = 2;
      let payableAmount = orderTotal + fixedShippingFee;
      let storeCredit = await StoreCredit.findOne({ userId });

      if (storeCredit && storeCredit.amount > 0) {
        const creditToApply = Math.min(storeCredit.amount, payableAmount);
        payableAmount -= creditToApply;
        storeCredit.amount -= creditToApply;
        if (storeCredit.amount === 0) {
          storeCredit.expiryDate = null;
        }
        await storeCredit.save();
      }

      const newOrder = new Order({
        userId,
        products: orderedProducts,
        amount: payableAmount,
        address,
        status: 'pending',
      });

      await newOrder.save();
      await Cart.findOneAndDelete({ userId });

      responseHandler(res, HttpStatus.CREATED, 'success', 'Order placed successfully', { order: newOrder });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  // Get all orders (Admin only)
  get_all_orders: async (req, res) => {
    try {
      const orders = await Order.find().sort({ createdAt: -1 });
      responseHandler(res, HttpStatus.OK, 'success', 'Orders retrieved successfully', { orders });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  // Get user's orders
  get_user_orders: async (req, res) => {
    try {
      const userId = req.user.id;
      const orders = await Order.find({ userId }).sort({ createdAt: -1 });

      if (!orders.length) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'No orders found for this user.');
      }

      responseHandler(res, HttpStatus.OK, 'success', 'Orders retrieved successfully', { orders });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  // Update order status (Admin only)
  update_order_status: async (req, res) => {
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
      if (!validStatuses.includes(status)) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid status provided.');
      }

      const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Order not found.');
      }

      responseHandler(res, HttpStatus.OK, 'success', 'Order status updated successfully', { order });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  // Delete an order (Admin only)
  delete_order: async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await Order.findByIdAndDelete(orderId);

      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Order not found.');
      }

      responseHandler(res, HttpStatus.OK, 'success', 'Order deleted successfully.');
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  // Cancel Order & Issue Store Credit (Admin only)
  cancelOrderAndIssueStoreCredit: async (req, res) => {
    try {
      const { orderId } = req.params;

      const order = await Order.findById(orderId);
      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Order not found.');
      }

      if (order.status === 'cancelled') {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Order is already cancelled.');
      }

      order.status = 'cancelled';
      await order.save();

      let storeCredit = await StoreCredit.findOne({ userId: order.userId });
      if (!storeCredit) {
        storeCredit = new StoreCredit({
          userId: order.userId,
          amount: order.amount,
          expiryDate: STORE_CREDIT_EXPIRY,
        });
      } else {
        storeCredit.amount += order.amount;
        storeCredit.expiryDate = STORE_CREDIT_EXPIRY;
      }

      await storeCredit.save();

      responseHandler(res, HttpStatus.OK, 'success', 'Order cancelled, store credit issued.', { order, storeCredit });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  // Get Total Income (Admin only)
  get_income: async (req, res) => {
    try {
      const totalIncome = await Order.aggregate([
        { $match: { status: { $in: ["pending", "processing", "shipped", "delivered"] } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      responseHandler(res, HttpStatus.OK, 'success', 'Total income calculated successfully', {
        totalIncome: totalIncome.length ? totalIncome[0].total : 0,
      });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },
};

export default orderController;
