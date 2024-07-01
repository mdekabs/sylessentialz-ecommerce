import stripe from "stripe";
import { responseHandler } from '../utils/index.js';

const stripeInstance = stripe(process.env.STRIPE_KEY);

const PaymentController = {
    async create_payment(req, res) {
        try {
            const { tokenId, amount } = req.body;

            const charge = await stripeInstance.charges.create({
                source: tokenId,
                amount,
                currency: "usd"
            });

            responseHandler(res, HttpStatus.OK, "success", "Payment processed successfully", { charge });
        } catch (error) {
            console.error("Error processing payment:", error);
            responseHandler(res, HttpStatus.INTERNAL_SERVER_ERROR, "error", "Payment processing failed", { error });
        }
    }
};

export default PaymentController;
