import express from 'express';
import { OrderController } from '../controllers/index.js';
import { authenticationVerifier, accessLevelVerifier, isAdminVerifier } from '../middlewares/_verifyToken.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management and retrieval
 */

/**
 * @swagger
 *  /orders:
 *   get:
 *     summary: Get all orders
 *     description: Retrieve all orders (admin only)
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/', isAdminVerifier, OrderController.get_orders);

/**
 * @swagger
 * /orders/income:
 *   get:
 *     summary: Get monthly income
 *     description: Retrieve monthly income (admin only)
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Monthly income retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/income', isAdminVerifier, OrderController.get_income);

/**
 * @swagger
 * /orders/{userId}:
 *   get:
 *     summary: Get user's orders
 *     description: Retrieve the orders of a specific user
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       401:
 *         description: Unauthorized - User or admin access required
 *       403:
 *         description: Forbidden - You are not allowed to perform this task
 *       404:
 *         description: Orders not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/:userId', accessLevelVerifier, OrderController.get_order);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create an order
 *     description: Create a new order
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               products:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                       default: 1
 *               amount:
 *                 type: number
 *                 required: true
 *               address:
 *                 type: object
 *                 required: true
 *               status:
 *                 type: string
 *                 default: "pending"
 *     responses:
 *       201:
 *         description: Order created successfully
 *       401:
 *         description: Unauthorized - User access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticationVerifier, OrderController.create_order);

export default router;
