import express from 'express';
import { OrderController } from '../controllers/index.js';
import { authenticationVerifier, isAdminVerifier, pagination, clearCache, cacheMiddleware } from '../middlewares/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Order management and retrieval
 */

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Get all orders (Admin only)
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
router.get('/', authenticationVerifier, isAdminVerifier, pagination, cacheMiddleware, OrderController.get_all_orders);

/**
 * @swagger
 * /orders/user:
 *   get:
 *     summary: Get authenticated user's orders
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *       401:
 *         description: Unauthorized - User access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/user', authenticationVerifier, pagination, cacheMiddleware, OrderController.get_user_orders);

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Create an order
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
router.post('/', authenticationVerifier, clearCache, OrderController.create_order);

/**
 * @swagger
 * /orders/{orderId}/status:
 *   patch:
 *     summary: Update order status (Admin only)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: "shipped"
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.patch('/:orderId/status', isAdminVerifier, clearCache, OrderController.update_order_status);



router.get('/:store_credit', authenticationVerifier, cacheMiddleware, OrderController.get_store_credit);

/**
 * @swagger
 * /orders/{orderId}/cancel:
 *   post:
 *     summary: Cancel an order and issue store credit
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the order to cancel
 *     responses:
 *       200:
 *         description: Order canceled and store credit issued
 *       401:
 *         description: Unauthorized - User access required
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/:orderId/cancel', authenticationVerifier, isAdminVerifier, clearCache, OrderController.cancelOrderAndIssueStoreCredit);

/**
 * @swagger
 * /orders/income:
 *   get:
 *     summary: Get monthly income (Admin only)
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
router.get('/income', isAdminVerifier, cacheMiddleware, OrderController.get_income);

export default router;
