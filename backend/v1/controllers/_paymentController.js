import HttpStatus from 'http-status-codes';
import stripe from "stripe";
import Order from "../models/_order.js";
import { responseHandler } from '../utils/index.js';

const stripeInstance = stripe(process.env.STRIPE_KEY);

const PaymentController = {
    async create_payment(req, res) {
        try {
            const { orderId, tokenId } = req.body;

            // Find the order
            const order = await Order.findById(orderId);
            if (!order) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "Order not found");
            }

            // Ensure the order is still pending
            if (order.status !== "pending") {
                return responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Order is not in a payable state.");
            }

            // Charge the customer
            const charge = await stripeInstance.charges.create({
                source: tokenId,
                amount: order.amount * 100, // Convert to cents
                currency: "usd"
            });

            // Update order status to "paid"
            order.status = "paid";
            await order.save();

            responseHandler(res, HttpStatus.OK, "success", "Payment processed successfully", { order, charge });
        } catch (error) {
            console.error("Error processing payment:", error);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Payment processing failed", { error });
        }
    }
};

export default PaymentController;
