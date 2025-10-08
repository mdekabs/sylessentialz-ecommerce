import mongoose from "mongoose";
import { Order, StoreCredit, Product, Cart } from "../models/index.js";
import { CartService } from "./_cartService.js";
const CONSTANTS = {
  STORE_CREDIT_EXPIRY_DAYS: 3 * 30,
  FIXED_SHIPPING_FEE: 2,
  VALID_ORDER_STATUSES: ["pending", "processing", "shipped", "delivered", "cancelled"],
  ORDER_STATUSES_FOR_INCOME: ["pending", "processing", "shipped", "delivered"],
  CART_TIMEOUT_MINUTES: 30,
};

const ERROR_MESSAGES = {
  ADDRESS_REQUIRED: "Address is required.",
  CART_EMPTY: "Your cart is empty.",
  CART_EXPIRED: "Cart has expired and been cleared.",
  PRODUCT_NOT_FOUND: "Product not found",
  ORDER_NOT_FOUND: "Order not found.",
  INVALID_STATUS: "Invalid status provided.",
  ALREADY_CANCELLED: "Order is already cancelled.",
  CONCURRENCY_CONFLICT: "Order or cart was modified by another request. Please retry.",
  SERVER_ERROR: "Something went wrong, please try again",
};

export class OrderService {
  /**
   * Creates a new order from the user's cart.
   * @param {Object} options - Order data (userId, address).
   * @returns {Object} Created order and applied credit.
   * @throws {Error} If validation fails, cart is empty, or transaction fails.
   */
  static async createOrder({ userId, address }) {
    if (!address) {
      throw new Error(ERROR_MESSAGES.ADDRESS_REQUIRED);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const cart = await Cart.findOne({ userId })
        .populate("products.productId", "name price stock image")
        .session(session);
      if (!cart || cart.products.length === 0) {
        throw new Error(ERROR_MESSAGES.CART_EMPTY);
      }

      const now = new Date();
      const timeoutThreshold = new Date(now - CONSTANTS.CART_TIMEOUT_MINUTES * 60 * 1000);
      if (cart.lastUpdated < timeoutThreshold) {
        await CartService.clearExpiredCart(cart._id);
        throw new Error(ERROR_MESSAGES.CART_EXPIRED);
      }

      let orderTotal = 0;
      const orderedProducts = cart.products.map((cartItem) => {
        const product = cartItem.productId;
        if (!product) {
          throw new Error(`${ERROR_MESSAGES.PRODUCT_NOT_FOUND}: ${cartItem.productId}`);
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
            $set: { expiryDate: storeCredit.amount - creditToApply === 0 ? null : storeCredit.expiryDate },
          },
          { new: true, session }
        );
      }

      const newOrder = new Order({
        userId,
        products: orderedProducts,
        amount: payableAmount,
        address,
        status: "pending",
        version: 0,
      });

      await newOrder.save({ session });

      const currentCartVersion = cart.version;
      const updatedCart = await Cart.findOneAndUpdate(
        { _id: cart._id, version: currentCartVersion },
        { products: [], lastUpdated: new Date(), $inc: { version: 1 } },
        { new: true, session }
      );
      if (!updatedCart) {
        throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
      }

      await session.commitTransaction();
      return { order: newOrder, creditApplied: creditToApply };
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Retrieves all orders with pagination.
   * @param {Object} options - Pagination options (page, limit).
   * @returns {Object} Orders and pagination data.
   * @throws {Error} If query fails.
   */
  static async getAllOrders({ page, limit }) {
    try {
      const skip = (page - 1) * limit;
      const [totalItems, orders] = await Promise.all([
        Order.countDocuments(),
        Order.find()
          .populate("products.productId", "name price stock image")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      return {
        orders,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      };
    } catch (err) {
      throw new Error(`Failed to retrieve orders: ${err.message}`);
    }
  }

  /**
   * Retrieves orders for a specific user.
   * @param {Object} options - Query options (userId, page, limit).
   * @returns {Object} Orders and pagination data.
   * @throws {Error} If query fails.
   */
  static async getUserOrders({ userId, page, limit }) {
    try {
      const skip = (page - 1) * limit;
      const [totalItems, orders] = await Promise.all([
        Order.countDocuments({ userId }),
        Order.find({ userId })
          .populate("products.productId", "name price stock image")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);

      return {
        orders,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      };
    } catch (err) {
      throw new Error(`Failed to retrieve user orders: ${err.message}`);
    }
  }

  /**
   * Updates the status of an order.
   * @param {Object} options - Order data (orderId, status).
   * @returns {Object} Updated order.
   * @throws {Error} If validation fails, order not found, or transaction fails.
   */
  static async updateOrderStatus({ orderId, status }) {
    if (!CONSTANTS.VALID_ORDER_STATUSES.includes(status)) {
      throw new Error(ERROR_MESSAGES.INVALID_STATUS);
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error(ERROR_MESSAGES.ORDER_NOT_FOUND);
      }

      const currentVersion = order.version;
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, version: currentVersion },
        { status, $inc: { version: 1 } },
        { new: true, session }
      );
      if (!updatedOrder) {
        throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
      }

      await session.commitTransaction();
      return updatedOrder;
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Cancels an order and issues store credit.
   * @param {Object} options - Order data (orderId).
   * @returns {Object} Cancelled order ID and store credit.
   * @throws {Error} If order not found, already cancelled, or transaction fails.
   */
  static async cancelOrderAndIssueStoreCredit({ orderId }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) {
        throw new Error(ERROR_MESSAGES.ORDER_NOT_FOUND);
      }
      if (order.status === "cancelled") {
        throw new Error(ERROR_MESSAGES.ALREADY_CANCELLED);
      }

      if (order.status === "pending") {
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
          version: 0,
        });
      } else {
        storeCredit = await StoreCredit.findOneAndUpdate(
          { userId: order.userId, version: storeCredit.version },
          {
            $inc: { amount: order.amount, version: 1 },
            $set: { expiryDate: newExpiryDate },
          },
          { new: true, session }
        );
      }
      await storeCredit.save({ session });

      const currentOrderVersion = order.version;
      const updatedOrder = await Order.findOneAndUpdate(
        { _id: orderId, version: currentOrderVersion },
        { status: "cancelled", $inc: { version: 1 } },
        { new: true, session }
      );
      if (!updatedOrder) {
        throw new Error(ERROR_MESSAGES.CONCURRENCY_CONFLICT);
      }

      await session.commitTransaction();
      return { orderId, storeCredit };
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message);
    } finally {
      session.endSession();
    }
  }

  /**
   * Calculates total income from orders and store credit.
   * @returns {Object} Income data.
   * @throws {Error} If aggregation fails.
   */
  static async getIncome() {
    try {
      const [activeOrdersResult, allOrdersResult, storeCreditResult] = await Promise.all([
        Order.aggregate([
          { $match: { status: { $in: CONSTANTS.ORDER_STATUSES_FOR_INCOME } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Order.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
        StoreCredit.aggregate([
          { $match: { expiryDate: { $gt: new Date() } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

      const activeOrderIncome = activeOrdersResult.length ? activeOrdersResult[0].total : 0;
      const totalOrderValue = allOrdersResult.length ? allOrdersResult[0].total : 0;
      const totalStoreCredit = storeCreditResult.length ? storeCreditResult[0].total : 0;

      const redeemedStoreCredit = totalOrderValue - activeOrderIncome - totalStoreCredit;
      const totalIncome = activeOrderIncome + (redeemedStoreCredit > 0 ? redeemedStoreCredit : 0);

      return {
        totalIncome,
        breakdown: {
          activeOrderIncome,
          redeemedStoreCredit: redeemedStoreCredit > 0 ? redeemedStoreCredit : 0,
          issuedStoreCredit: totalStoreCredit,
        },
      };
    } catch (err) {
      throw new Error(`Failed to calculate income: ${err.message}`);
    }
  }

  /**
   * Retrieves the user's store credit.
   * @param {string} userId - User ID.
   * @returns {Object} Store credit data.
   * @throws {Error} If query fails.
   */
  static async getStoreCredit(userId) {
    try {
      const storeCredit = await StoreCredit.findOne({ userId }).lean();
      if (!storeCredit || storeCredit.amount <= 0 || storeCredit.expiryDate < new Date()) {
        return { amount: 0, expiryDate: null };
      }
      return storeCredit;
    } catch (err) {
      throw new Error(`Failed to retrieve store credit: ${err.message}`);
    }
  }
}
