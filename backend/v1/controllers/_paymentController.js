import HttpStatus from 'http-status-codes';
import https from 'https';
import mongoose from 'mongoose';
import { Order, Shipping } from "../models/index.js";
import { v4 as uuidv4 } from 'uuid';
import { responseHandler } from '../utils/index.js';
import dotenv from 'dotenv';

/**
 * Constants for payment operations.
 */
const STATUS_PENDING = "pending";
const STATUS_PAID = "paid";
const ERROR_MESSAGE_NO_ORDERS = "No pending orders found for this user.";
const ERROR_MESSAGE_PAYMENT_FAILED = "Payment initialization failed";
const ERROR_MESSAGE_PROCESSING_FAILED = "Payment processing failed";
const SUCCESS_MESSAGE_PAYMENT_PROCESSED = "Payment initialized successfully, proceed to authorization";
const DEFAULT_CURRENCY = process.env.DEFAULT_CURRENCY || "ngn"; // Configurable via .env
const CARRIER_DHL = "DHL";
const TIME_ESTIMATED_DELIVERY_HOURS = 24;
const CENTS_MULTIPLIER = 100;
const NEGATIVE_ONE = -1;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const PaymentController = {
  async create_payment(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { email, currency = DEFAULT_CURRENCY } = req.body; // Allow currency from request
      const userId = req.user.id;

      const order = await Order.findOne({ userId, status: STATUS_PENDING })
        .sort({ createdAt: NEGATIVE_ONE })
        .session(session);
      if (!order) {
        return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGE_NO_ORDERS);
      }

      const params = JSON.stringify({
        email: email || `${userId}@example.com`,
        amount: Math.round(order.amount * CENTS_MULTIPLIER), // Adjust based on currency
        currency: currency.toLowerCase() // Ensure lowercase for Paystack
      });

      console.log("Paystack Params:", params); // Debug payload

      const options = {
        hostname: 'api.paystack.co',
        port: 443,
        path: '/transaction/initialize',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      };

      const paystackResponse = await new Promise((resolve, reject) => {
        const paystackReq = https.request(options, (paystackRes) => {
          let data = '';
          paystackRes.on('data', (chunk) => { data += chunk; });
          paystackRes.on('end', () => { resolve(JSON.parse(data)); });
        }).on('error', (error) => { reject(error); });

        paystackReq.write(params);
        paystackReq.end();
      });

      if (paystackResponse.status && paystackResponse.data && paystackResponse.data.authorization_url) {
        order.status = STATUS_PAID;
        await order.save({ session });

        const estimatedDeliveryDate = new Date();
        estimatedDeliveryDate.setHours(estimatedDeliveryDate.getHours() + TIME_ESTIMATED_DELIVERY_HOURS);

        const trackingNumber = `${CARRIER_DHL.toUpperCase()}-${uuidv4()}`;
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
          paystack: {
            authorization_url: paystackResponse.data.authorization_url,
            access_code: paystackResponse.data.access_code,
            reference: paystackResponse.data.reference
          },
          shipment: newShipment
        });
      } else {
        await session.abortTransaction();
        responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGE_PAYMENT_FAILED, { paystackResponse });
      }
    } catch (error) {
      await session.abortTransaction();
      console.error("Error processing payment:", error);
      responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGE_PROCESSING_FAILED, { error });
    } finally {
      session.endSession();
    }
  }
};

export default PaymentController;
