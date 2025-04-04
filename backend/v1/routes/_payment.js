import express from 'express';
import { authenticationVerifier } from '../middlewares/index.js';
import { PaymentController } from '../controllers/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing
 */

/**
 * @swagger
 * /payment:
 *   post:
 *     summary: Process a payment
 *     description: Process a payment using Stripe
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tokenId:
 *                 type: string
 *                 description: The Stripe token ID
 *               amount:
 *                 type: number
 *                 description: The amount to charge in cents
 *             required:
 *               - tokenId
 *               - amount
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       401:
 *         description: Unauthorized - User access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticationVerifier, PaymentController.create_payment);

export default router;
