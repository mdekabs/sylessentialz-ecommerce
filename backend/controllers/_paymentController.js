import stripe from "stripe";
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

            res.status(200).json(charge);
        } catch (error) {
            console.error("Error processing payment:", error);
            res.status(500).json({ error: "Payment processing failed" });
        }
    }
};

export default PaymentController;
