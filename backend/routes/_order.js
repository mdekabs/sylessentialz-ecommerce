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
 * /api/v1/orders:
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
 * /api/v1/orders/income:
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
 * /api/v1/orders/{userId}:
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
 * /api/v1/orders:
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

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   put:
 *     summary: Update an order
 *     description: Update the order with the specified ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
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
 *               amount:
 *                 type: number
 *               address:
 *                 type: object
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order updated successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       403:
 *         description: Forbidden - You are not allowed to perform this task
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', isAdminVerifier, OrderController.update_order);

/**
 * @swagger
 * /api/v1/orders/{id}:
 *   delete:
 *     summary: Delete an order
 *     description: Delete the order with the specified ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The order ID
 *     responses:
 *       200:
 *         description: Order deleted successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       403:
 *         description: Forbidden - You are not allowed to perform this task
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', isAdminVerifier, OrderController.delete_order);

export default router;
