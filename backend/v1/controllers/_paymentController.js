import HttpStatus from 'http-status-codes';
import stripe from "stripe";
import { Order, Shipping } from "../models/index.js";
import { v4 as uuidv4 } from 'uuid';
import { responseHandler } from '../utils/index.js';

const stripeInstance = stripe(process.env.STRIPE_KEY);

// Constants
const STATUS_PENDING = "pending";
const STATUS_PAID = "paid";
const ERROR_MESSAGE_NO_ORDERS = "No pending orders found for this user.";
const ERROR_MESSAGE_PAYMENT_FAILED = "Payment failed";
const ERROR_MESSAGE_PROCESSING_FAILED = "Payment processing failed";
const SUCCESS_MESSAGE_PAYMENT_PROCESSED = "Payment processed and shipment created successfully";
const CURRENCY_USD = "usd";
const CARRIER_DHL = "DHL";
const TIME_ESTIMATED_DELIVERY_HOURS = 24;
const CENTS_MULTIPLIER = 100;
const NEGATIVE_ONE = -1

const PaymentController = {
    async create_payment(req, res) {
        try {
            const { tokenId } = req.body;
            const userId = req.user.id;

            // Find the user's most recent pending order
            const order = await Order.findOne({ userId, status: STATUS_PENDING }).sort({ createdAt: NEGATIVE_ONE });
            if (!order) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", ERROR_MESSAGE_NO_ORDERS);
            }

            // Charge the customer
            const charge = await stripeInstance.charges.create({
                source: tokenId,
                amount: order.amount * CENTS_MULTIPLIER, // Convert to cents
                currency: CURRENCY_USD
            });

            if (charge.status === "succeeded") {
                // Update order status to "paid"
                order.status = STATUS_PAID;
                await order.save();

                // Set carrier and estimated delivery date
                const estimatedDeliveryDate = new Date();
                estimatedDeliveryDate.setHours(estimatedDeliveryDate.getHours() + TIME_ESTIMATED_DELIVERY_HOURS);

                // Create shipment
                const trackingNumber = `${CARRIER_DHL.toUpperCase()}-${uuidv4()}`;
                const newShipment = new Shipping({
                    orderId: order._id,
                    trackingNumber,
                    carrier: CARRIER_DHL,
                    estimatedDeliveryDate
                });

                const savedShipment = await newShipment.save();

                responseHandler(res, HttpStatus.OK, "success", SUCCESS_MESSAGE_PAYMENT_PROCESSED, {
                    order,
                    charge,
                    shipment: savedShipment
                });
            } else {
                responseHandler(res, HttpStatus.BAD_REQUEST, "error", ERROR_MESSAGE_PAYMENT_FAILED);
            }

        } catch (error) {
            console.error("Error processing payment:", error);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", ERROR_MESSAGE_PROCESSING_FAILED, { error });
        }
    }
};

export default PaymentController;
