import HttpStatus from 'http-status-codes';
import stripe from "stripe";
import { Order, Shipping } from "../models/index.js";
import { v4 as uuidv4 } from 'uuid';
import { responseHandler } from '../utils/index.js';

const stripeInstance = stripe(process.env.STRIPE_KEY);

const PaymentController = {
    async create_payment(req, res) {
        try {
            const { tokenId } = req.body; // No need for userId in request body
            const userId = req.user.id; // Automatically retrieve userId from authenticated request

            // Find the user's most recent pending order
            const order = await Order.findOne({ userId, status: "pending" }).sort({ createdAt: -1 });
            if (!order) {
                return responseHandler(res, HttpStatus.NOT_FOUND, "error", "No pending orders found for this user.");
            }

            // Charge the customer
            const charge = await stripeInstance.charges.create({
                source: tokenId,
                amount: order.amount * 100, // Convert to cents
                currency: "usd"
            });

            if (charge.status === "succeeded") {
                // Update order status to "paid"
                order.status = "paid";
                await order.save();

                // Set carrier and estimated delivery date (24 hours from now)
                const carrier = "DHL";
                const estimatedDeliveryDate = new Date();
                estimatedDeliveryDate.setHours(estimatedDeliveryDate.getHours() + 24);

                // Create shipment
                const trackingNumber = `${carrier.toUpperCase()}-${uuidv4()}`;
                const newShipment = new Shipping({
                    orderId: order._id,
                    trackingNumber,
                    carrier,
                    estimatedDeliveryDate
                });

                const savedShipment = await newShipment.save();

                responseHandler(res, HttpStatus.OK, "success", "Payment processed and shipment created successfully", {
                    order,
                    charge,
                    shipment: savedShipment
                });
            } else {
                responseHandler(res, HttpStatus.BAD_REQUEST, "error", "Payment failed");
            }

        } catch (error) {
            console.error("Error processing payment:", error);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Payment processing failed", { error });
        }
    }
};

export default PaymentController;
