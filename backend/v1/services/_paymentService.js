import mongoose from "mongoose";
import https from "https";
import { Order, Shipping } from "../models/index.js";
import { v4 as uuidv4 } from "uuid";

const STATUS_PENDING = "pending";
const STATUS_PAID = "paid";
const CARRIER_DHL = "DHL";
const TIME_ESTIMATED_DELIVERY_HOURS = 24;
const CENTS_MULTIPLIER = 100;
const NEGATIVE_ONE = -1;
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "ngn";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const ERROR_MESSAGES = {
  NO_ORDERS: "No pending orders found for this user.",
  PAYMENT_FAILED: "Payment initialization failed",
  PROCESSING_FAILED: "Payment processing failed",
  SERVER_ERROR: "Something went wrong, please try again",
};

export class PaymentService {
  /**
   * Initializes a payment for a user's pending order and creates a shipment.
   * @param {Object} options - Payment data (userId, email, currency).
   * @returns {Object} Order, Paystack response, and shipment data.
   * @throws {Error} If no orders found, payment fails, or transaction fails.
   */
  static async createPayment({ userId, email, currency = DEFAULT_CURRENCY }) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findOne({ userId, status: STATUS_PENDING })
        .sort({ createdAt: NEGATIVE_ONE })
        .session(session);
      if (!order) {
        throw new Error(ERROR_MESSAGES.NO_ORDERS);
      }

      const params = JSON.stringify({
        email: email || `${userId}@example.com`,
        amount: Math.round(order.amount * CENTS_MULTIPLIER),
        currency: currency.toLowerCase(),
      });

      const options = {
        hostname: "api.paystack.co",
        port: 443,
        path: "/transaction/initialize",
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      };

      const paystackResponse = await new Promise((resolve, reject) => {
        const paystackReq = https.request(options, (paystackRes) => {
          let data = "";
          paystackRes.on("data", (chunk) => {
            data += chunk;
          });
          paystackRes.on("end", () => {
            resolve(JSON.parse(data));
          });
        }).on("error", (error) => {
          reject(error);
        });

        paystackReq.write(params);
        paystackReq.end();
      });

      if (!paystackResponse.status || !paystackResponse.data || !paystackResponse.data.authorization_url) {
        throw new Error(ERROR_MESSAGES.PAYMENT_FAILED);
      }

      order.status = STATUS_PAID;
      await order.save({ session });

      const estimatedDeliveryDate = new Date();
      estimatedDeliveryDate.setHours(estimatedDeliveryDate.getHours() + TIME_ESTIMATED_DELIVERY_HOURS);

      const trackingNumber = `${CARRIER_DHL.toUpperCase()}-${uuidv4()}`;
      const newShipment = new Shipping({
        orderId: order._id,
        trackingNumber,
        carrier: CARRIER_DHL,
        estimatedDeliveryDate,
      });

      await newShipment.save({ session });

      await session.commitTransaction();

      return {
        order,
        paystack: {
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code,
          reference: paystackResponse.data.reference,
        },
        shipment: newShipment,
      };
    } catch (err) {
      await session.abortTransaction();
      throw new Error(err.message === ERROR_MESSAGES.NO_ORDERS || err.message === ERROR_MESSAGES.PAYMENT_FAILED ? err.message : `${ERROR_MESSAGES.PROCESSING_FAILED}: ${err.message}`);
    } finally {
      session.endSession();
    }
  }
}
