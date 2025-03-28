import HttpStatus from 'http-status-codes';
import { Order, StoreCredit, Product, Cart } from "../models/index.js";
import { responseHandler } from '../utils/index.js';

// Constants
const CONSTANTS = {
  STORE_CREDIT_EXPIRY_DAYS: 3 * 30,
  FIXED_SHIPPING_FEE: 2,
  VALID_ORDER_STATUSES: ["pending", "processing", "shipped", "delivered", "cancelled"],
  ORDER_STATUSES_FOR_INCOME: ["pending", "processing", "shipped", "delivered"]
};

const orderController = {
  create_order: async (req, res) => {
    try {
      const userId = req.user.id;
      const { address } = req.body;

      const cart = await Cart.findOne({ userId });
      if (!cart || cart.products.length === 0) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Your cart is empty.');
      }

      const productIds = cart.products.map(cartItem => cartItem.productId);
      const products = await Product.find({ _id: { $in: productIds } });

      const productMap = new Map(products.map(p => [p._id.toString(), p]));

      let orderTotal = 0;
      const orderedProducts = [];

      for (const cartItem of cart.products) {
        const product = productMap.get(cartItem.productId.toString());
        if (!product) {
          return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', `Product not found: ${cartItem.productId}`);
        }
        orderTotal += product.price * cartItem.quantity;
        orderedProducts.push({ productId: cartItem.productId, quantity: cartItem.quantity });
      }

      let payableAmount = orderTotal + CONSTANTS.FIXED_SHIPPING_FEE;
      let creditToApply = 0;

      const storeCredit = await StoreCredit.findOne({ userId });
      if (storeCredit && storeCredit.amount > 0) {
        creditToApply = Math.min(storeCredit.amount, payableAmount);
        payableAmount -= creditToApply;

        await StoreCredit.findOneAndUpdate(
          { userId },
          {
            $inc: { amount: -creditToApply },
            $set: { expiryDate: storeCredit.amount - creditToApply === 0 ? null : storeCredit.expiryDate }
          },
          { new: true }
        );
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

      responseHandler(res, HttpStatus.CREATED, 'success', 'Order placed successfully', { 
        order: newOrder,
        creditApplied: creditToApply
      });
    } catch (error) {
      console.error('Create order error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  get_all_orders: async (req, res) => {
    try {
      const { page, limit } = res.locals.pagination;
      const skip = (page - 1) * limit;

      const totalItems = await Order.countDocuments();
      const orders = await Order.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

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
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

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
    try {
      const { orderId } = req.params;
      const { status } = req.body;

      if (!CONSTANTS.VALID_ORDER_STATUSES.includes(status)) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Invalid status provided.');
      }

      const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Order not found.');
      }

      responseHandler(res, HttpStatus.OK, 'success', 'Order status updated successfully', { order });
    } catch (error) {
      console.error('Update order status error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

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

      let storeCredit = await StoreCredit.findOne({ userId: order.userId });
      const newExpiryDate = new Date(Date.now() + CONSTANTS.STORE_CREDIT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      if (!storeCredit) {
        storeCredit = new StoreCredit({
          userId: order.userId,
          amount: order.amount,
          expiryDate: newExpiryDate,
        });
      } else {
        storeCredit.amount += order.amount;
        storeCredit.expiryDate = newExpiryDate;
      }
      await storeCredit.save();

      order.status = 'cancelled';
      await order.save();

      responseHandler(res, HttpStatus.OK, 'success', 'Order cancelled and store credit issued.', { 
        orderId, 
        storeCredit 
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
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

      const storeCredit = await StoreCredit.findOne({ userId });

      if (!storeCredit) {
        return responseHandler(res, HttpStatus.OK, 'success', 'No store credit available.', {
          storeCredit: { amount: 0, expiryDate: null }
        });
      }

      responseHandler(res, HttpStatus.OK, 'success', 'Store credit retrieved successfully.', { storeCredit });
    } catch (error) {
      console.error('Get store credit error:', error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },
};

export default orderController;
