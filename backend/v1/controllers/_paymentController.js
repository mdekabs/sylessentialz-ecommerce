import HttpStatus from 'http-status-codes';
import stripe from "stripe";
import mongoose from 'mongoose';
import { Order, Shipping, Cart } from "../models/index.js";
import { v4 as uuidv4 } from 'uuid';
import { responseHandler } from '../utils/index.js';

const stripeInstance = stripe(process.env.STRIPE_KEY); // Initialize Stripe with secret key

/**
 * Constants for payment operations.
 */
const STATUS_PENDING = "pending";                      // Order status before payment
const STATUS_PAID = "paid";                            // Order status after payment
const ERROR_MESSAGE_NO_ORDERS = "No pending orders found for this user.";
const ERROR_MESSAGE_PAYMENT_FAILED = "Payment failed";
const ERROR_MESSAGE_PROCESSING_FAILED = "Payment processing failed";
const SUCCESS_MESSAGE_PAYMENT_PROCESSED = "Payment processed and shipment created successfully";
const CURRENCY_USD = "usd";                            // Currency for Stripe charges
const CARRIER_DHL = "DHL";                             // Default shipping carrier
const TIME_ESTIMATED_DELIVERY_HOURS = 24;              // Estimated delivery time in hours
const CENTS_MULTIPLIER = 100;                          // Convert dollars to cents for Stripe
const NEGATIVE_ONE = -1;                               // Descending sort order

/**
 * Controller for managing payment operations with Stripe.
 */
const PaymentController = {
  /**
   * Processes a payment for a pending order and creates a shipment.
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  async create_payment(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { tokenId } = req.body;                   // Stripe token from client
      const userId = req.user.id;                     // Authenticated user ID

      const order = await Order.findOne({ userId, status: STATUS_PENDING })
        .sort({ createdAt: NEGATIVE_ONE })           // Get latest pending order
        .session(session);
      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGE_NO_ORDERS);
      }

      const cart = await Cart.findOne({ userId }).session(session);
      if (!cart) {
        return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Cart not found (should have been cleared after order creation)");
      }

      const charge = await stripeInstance.charges.create({
        source: tokenId,                              // Payment token
        amount: Math.round(order.amount * CENTS_MULTIPLIER), // Convert to cents
        currency: CURRENCY_USD                        // Charge in USD
      });

      if (charge.status === "succeeded") {
        order.status = STATUS_PAID;                   // Update order status
        await order.save({ session });

        if (cart.products.length > 0) {
          const currentVersion = cart.version;
          const updatedCart = await Cart.findOneAndUpdate(
            { _id: cart._id, version: currentVersion },
            { products: [], lastUpdated: new Date(), $inc: { version: 1 } }, // Clear cart
            { new: true, session }
          );
          if (!updatedCart) {
            throw new Error("Cart was modified by another request. Please retry.");
          }
        }

        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setHours(estimatedDeliveryDate.getHours() + TIME_ESTIMATED_DELIVERY_HOURS); // Set ETA

        const trackingNumber = `${CARRIER_DHL.toUpperCase()}-${uuidv4()}`; // Generate unique tracking number
        const newShipment = new Shipping({
          orderId: order._id,
          trackingNumber,
          carrier: CARRIER_DHL,
          estimatedDeliveryDate
        });

        await newShipment.save({ session });

        await session.commitTransaction();

        responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGE_PAYMENT_PROCESSED, {
          order,
          charge,
          shipment: newShipment
        });
      } else {
        await session.abortTransaction();
        responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGE_PAYMENT_FAILED);
      }
    } catch (error) {
      await session.abortTransaction();
      console.error("Error processing payment:", error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGE_PROCESSING_FAILED, { error });
    } finally {
      session.endSession();                           // Clean up session
    }
  }
};

export default PaymentController;
