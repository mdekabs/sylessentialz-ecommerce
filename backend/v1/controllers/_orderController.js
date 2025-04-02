import HttpStatus from 'http-status-codes';
import mongoose from 'mongoose';
import { Order, StoreCredit, Product, Cart } from "../models/index.js";
import { responseHandler } from '../utils/index.js';

// Constants
const CONSTANTS = {
  STORE_CREDIT_EXPIRY_DAYS: 3 * 30,
  FIXED_SHIPPING_FEE: 2,
  VALID_ORDER_STATUSES: ["pending", "processing", "shipped", "delivered", "cancelled"],
  ORDER_STATUSES_FOR_INCOME: ["pending", "processing", "shipped", "delivered"]
};

const OrderController = {
  create_order: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const userId = req.user.id;
      const { address } = req.body;

      if (!address) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Address is required.');
      }

      const cart = await Cart.findOne({ userId }).populate('products.productId', 'name price stock image').session(session);
      if (!cart || cart.products.length === 0) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Your cart is empty.');
      }

      const now = new Date();
      const timeoutThreshold = new Date(now - 30 * 60 * 1000); // 30 minutes expiration from CartController
      if (cart.lastUpdated < timeoutThreshold) {
        await CartController.clearExpiredCart(cart._id);
        await session.commitTransaction();
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Cart has expired and been cleared.');
      }

      let orderTotal = 0;
      const orderedProducts = cart.products.map(cartItem => {
        const product = cartItem.productId;
        if (!product) {
          throw new Error(`Product not found: ${cartItem.productId}`);
        }
        orderTotal += product.price * cartItem.quantity;
        return { productId: cartItem.productId._id, quantity: cartItem.quantity };
      });

      let payableAmount = orderTotal + CONSTANTS.FIXED_SHIPPING_FEE;
      let creditToApply = 0;

      const storeCredit = await StoreCredit.findOne({ userId }).session(session);
      if (storeCredit && storeCredit.amount > 0 && storeCredit.expiryDate > now) {
        creditToApply = Math.min(storeCredit.amount, payableAmount);
        payableAmount -= creditToApply;

        await StoreCredit.findOneAndUpdate(
          { userId, version: storeCredit.version },
          {
            $inc: { amount: -creditToApply, version: 1 },
            $set: { expiryDate: storeCredit.amount - creditToApply === 0 ? null : storeCredit.expiryDate }
          },
          { new: true, session }
        );
      }

      const newOrder = new Order({
        userId,
        products: orderedProducts,
        amount: payableAmount,
        address,
        status: 'pending',
        version: 0
      });

      await newOrder.save({ session });

      const currentCartVersion = cart.version;
      const updatedCart = await Cart.findOneAndUpdate(
        { _id: cart._id, version: currentCartVersion },
        { products: [], lastUpdated: new Date(), $inc: { version: 1 } },
        { new: true, session }
      );
      if (!updatedCart) {
        throw new Error('Cart was modified by another request. Please retry.');
      }

      await session.commitTransaction();

      responseHandler(res, HttpStatus.CREATED, 'success', 'Order placed successfully', { 
        order: newOrder,
        creditApplied: creditToApply
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Create order error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    } finally {
      session.endSession();
    }
  },

  get_all_orders: async (req, res) => {
    try {
      const { page, limit } = res.locals.pagination;
      const skip = (page - 1) * limit;

      const totalItems = await Order.countDocuments();
      const orders = await Order.find()
        .populate('products.productId', 'name price stock image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      res.locals.setPagination(totalItems);

      responseHandler(res, HttpStatus.OK, 'success', 'Orders retrieved successfully', {
        orders,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: res.locals.pagination.totalPages,
          hasMorePages: res.locals.pagination.hasMorePages,
          links: res.locals.pagination.links
        }
      });
    } catch (error) {
      console.error('Get all orders error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  get_user_orders: async (req, res) => {
    try {
      const userId = req.user.id;
      const { page, limit } = res.locals.pagination;
      const skip = (page - 1) * limit;

      const totalItems = await Order.countDocuments({ userId });
      const orders = await Order.find({ userId })
        .populate('products.productId', 'name price stock image')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      res.locals.setPagination(totalItems);

      responseHandler(res, HttpStatus.OK, 'success', 'Orders retrieved successfully', {
        orders,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: res.locals.pagination.totalPages,
          hasMorePages: res.locals.pagination.hasMorePages,
          links: res.locals.pagination.links
        }
      });
    } catch (error) {
      console.error('Get user orders error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  update_order_status: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      if (!CONSTANTS.VALID_ORDER_STATUSES.includes(status)) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid status provided.');
      }

      const order = await Order.findById(orderId).session(session);
      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Order not found.');
      }

      const currentVersion = order.version;
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, version: currentVersion },
        { status, $inc: { version: 1 } },
        { new: true, session }
      );
      if (!updatedOrder) {
        throw new Error('Order was modified by another request. Please retry.');
      }

      await session.commitTransaction();

      responseHandler(res, HttpStatus.OK, 'success', 'Order status updated successfully', { order: updatedOrder });
    } catch (error) {
      await session.abortTransaction();
      console.error('Update order status error:', error);
      responseHandler(res, error.message.includes('modified') ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    } finally {
      session.endSession();
    }
  },

  cancelOrderAndIssueStoreCredit: async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { orderId } = req.params;

      const order = await Order.findById(orderId).session(session);
      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Order not found.');
      }

      if (order.status === 'cancelled') {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Order is already cancelled.');
      }

      if (order.status === 'pending') {
        for (const item of order.products) {
          const product = await Product.findOneAndUpdate(
            { _id: item.productId, version: { $gte: 0 } },
            { $inc: { stock: item.quantity, version: 1 } },
            { new: true, session }
          );
          if (!product) {
            console.warn(`Product ${item.productId} not found during cancellation`);
          }
        }
      }

      let storeCredit = await StoreCredit.findOne({ userId: order.userId }).session(session);
      const newExpiryDate = new Date(Date.now() + CONSTANTS.STORE_CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      if (!storeCredit) {
        storeCredit = new StoreCredit({
          userId: order.userId,
          amount: order.amount,
          expiryDate: newExpiryDate,
          version: 0
        });
      } else {
        storeCredit = await StoreCredit.findOneAndUpdate(
          { userId: order.userId, version: storeCredit.version },
          { 
            $inc: { amount: order.amount, version: 1 },
            $set: { expiryDate: newExpiryDate }
          },
          { new: true, session }
        );
      }
      await storeCredit.save({ session });

      const currentOrderVersion = order.version;
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, version: currentOrderVersion },
        { status: 'cancelled', $inc: { version: 1 } },
        { new: true, session }
      );
      if (!updatedOrder) {
        throw new Error('Order was modified by another request. Please retry.');
      }

      await session.commitTransaction();

      responseHandler(res, HttpStatus.OK, 'success', 'Order cancelled and store credit issued.', { 
        orderId, 
        storeCredit 
      });
    } catch (error) {
      await session.abortTransaction();
      console.error('Cancel order error:', error);
      responseHandler(res, error.message.includes('modified') ? HttpStatus.CONFLICT : HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    } finally {
      session.endSession();
    }
  },

  get_income: async (req, res) => {
    try {
      const [activeOrdersResult, allOrdersResult, storeCreditResult] = await Promise.all([
        Order.aggregate([
          { $match: { status: { $in: CONSTANTS.ORDER_STATUSES_FOR_INCOME } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Order.aggregate([
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        StoreCredit.aggregate([
          { $match: { expiryDate: { $gt: new Date() } } }, // Only active credits
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
      ]);

      const activeOrderIncome = activeOrdersResult.length ? activeOrdersResult[0].total : 0;
      const totalOrderValue = allOrdersResult.length ? allOrdersResult[0].total : 0;
      const totalStoreCredit = storeCreditResult.length ? storeCreditResult[0].total : 0;

      const redeemedStoreCredit = totalOrderValue - activeOrderIncome - totalStoreCredit;
      const totalIncome = activeOrderIncome + (redeemedStoreCredit > 0 ? redeemedStoreCredit : 0);

      responseHandler(res, HttpStatus.OK, 'success', 'Total income calculated successfully', {
        totalIncome,
        breakdown: {
          activeOrderIncome,
          redeemedStoreCredit: redeemedStoreCredit > 0 ? redeemedStoreCredit : 0,
          issuedStoreCredit: totalStoreCredit
        }
      });
    } catch (error) {
      console.error('Get income error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  get_store_credit: async (req, res) => {
    try {
      const userId = req.user.id;

      const storeCredit = await StoreCredit.findOne({ userId }).lean();

      if (!storeCredit || storeCredit.amount <= 0 || storeCredit.expiryDate < new Date()) {
        return responseHandler(res, HttpStatus.OK, 'success', 'No active store credit available.', {
          storeCredit: { amount: 0, expiryDate: null }
        });
      }

      responseHandler(res, HttpStatus.OK, 'success', 'Store credit retrieved successfully.', { storeCredit });
    } catch (error) {
      console.error('Get store credit error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  }
};

export default OrderController;
