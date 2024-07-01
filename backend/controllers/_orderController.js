//import Order from "../models/_order.js";
import StoreCredit from "../models/_storeCredit.js";
//import User from "../models/_user.js";
import { responseHandler } from '../utils/index.js';

const STORE_CREDIT_EXPIRY = new Date(Date.now() + 3 * 30 * 24 * 60 * 60 * 1000);

const orderController = {
  get_orders: async (req, res) => {
    try {
      const orders = await Order.find();
      responseHandler(res, HttpStatus.OK, 'success', '', { orders });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
    }
  },

  get_income: async (req, res) => {
    const date = new Date();
    const lastMonth = new Date(date.setMonth(date.getMonth() - 1));
    const previousMonth = new Date(new Date().setMonth(lastMonth.getMonth() - 1));

    try {
      const income = await Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: previousMonth
            }
          },
        },
        {
          $project: {
            month: { $month: "$createdAt" },
            sales: "$amount",
          },
        },
        {
          $group: {
            _id: "$month",
            total: { $sum: "$sales" }
          }
        },
      ]);
      responseHandler(res, HttpStatus.OK, 'success', '', { income });
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
    }
  },

  get_order: async (req, res) => {
    try {
      const orders = await Order.findOne({ userId: req.params.userId });
      if (!orders) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', "User doesn't exist");
      } else {
        responseHandler(res, HttpStatus.OK, 'success', '', { orders });
      }
    } catch (err) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', 'Something went wrong, please try again', { err });
    }
  },

  create_order: async (req, res) => {
    try {
      const userId = req.user.id;

      const { products, address } = req.body;
      let orderTotal = 0;
      products.forEach(product => {
        orderTotal += product.price * product.quantity;
      });

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
        products,
        amount: orderTotal,
        address,
        status: 'pending',
      
      });

      await newOrder.save();

      responseHandler(res, HttpStatus.CREATED, 'success', 'Order placed successfully', { order: newOrder });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  },

  cancelOrderAndIssueStoreCredit: async (req, res) => {
    try {
      const { orderId } = req.params;
      const order = await Order.findById(orderId);
      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'Order not found');
      }

      const user = await User.findById(order.userId);
      if (!user) {
        return responseHandler(res, HttpStatus.NOT_FOUND, 'error', 'User not found');
      }

      if (order.status !== 'pending') {
        return responseHandler(res, HttpStatus.BAD_REQUEST, 'error', 'Order cannot be cancelled');
      }

      const storeCreditAmount = order.amount;

      let storeCredit = await StoreCredit.findOne({ userId: user._id });
      if (!storeCredit) {
        storeCredit = new StoreCredit({
          userId: user._id,
          amount: storeCreditAmount,
          expiryDate: STORE_CREDIT_EXPIRY,
          orders: [order._id]
        });
      } else {
        storeCredit.amount += storeCreditAmount;
        storeCredit.expiryDate = STORE_CREDIT_EXPIRY;
        storeCredit.orders.push(order._id);
      }

      await storeCredit.save();

      order.status = 'cancelled';
      await order.save();

      responseHandler(res, HttpStatus.OK, 'success', 'Order cancelled and store credit issued', { storeCredit });
    } catch (error) {
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, 'error', error.message);
    }
  }
};

export default orderController;
