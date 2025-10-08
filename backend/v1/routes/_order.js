import express from "express";
import { OrderController } from "../controllers/index.js";
import { 
  authenticationVerifier, 
  accessLevelVerifier, 
  isAdminVerifier, 
  optionalVerifier, 
  cacheMiddleware, 
  pagination, 
  clearCache 
} from "../middlewares/index.js";

const router = express.Router();

/**
 * @swagger
 * /api/v1/orders:
 *   post:
 *     summary: Create a new order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address:
 *                 type: string
 *                 description: Shipping address for the order
 *                 example: "123 Main St, City, Country"
 *     responses:
 *       201:
 *         description: Order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type: { type: string, example: "success" }
 *                 message: { type: string, example: "Order placed successfully" }
 *                 data: { type: object }
 *       400:
 *         description: Bad request (e.g., missing address or empty cart)
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authenticationVerifier, 
  clearCache, 
  OrderController.createOrder
);

/**
 * @swagger
 * /api/v1/orders:
 *   get:
 *     summary: Retrieve all orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of orders per page
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type: { type: string, example: "success" }
 *                 message: { type: string, example: "Orders retrieved successfully" }
 *                 data: { type: object, properties: { orders: { type: array }, pagination: { type: object } } }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 */
router.get(
  "/",
  authenticationVerifier,                // Verify user authentication
  isAdminVerifier,                       // Restrict to admin users
  pagination,                            // Apply pagination middleware
  cacheMiddleware,    // Cache results for 5 minutes
  OrderController.getAllOrders // Handle retrieving all orders
);

/**
 * @swagger
 * /api/v1/orders/user:
 *   get:
 *     summary: Retrieve orders for the authenticated user
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Number of orders per page
 *     responses:
 *       200:
 *         description: User orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type: { type: string, example: "success" }
 *                 message: { type: string, example: "Orders retrieved successfully" }
 *                 data: { type: object, properties: { orders: { type: array }, pagination: { type: object } } }
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/user",
  authenticationVerifier,                // Verify user authentication
  pagination,                            // Apply pagination middleware
  cacheMiddleware,   // Cache user-specific orders for 5 minutes
  OrderController.getUserOrders// Handle retrieving user orders
);

/**
 * @swagger
 * /api/v1/orders/{orderId}/status:
 *   put:
 *     summary: Update an order's status (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *         description: The ID of the order
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, processing, shipped, delivered, cancelled]
 *                 description: New status for the order
 *     responses:
 *       200:
 *         description: Order status updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 *       404:
 *         description: Order not found
 */
router.put(
  "/:orderId/status",
  authenticationVerifier,                // Verify user authentication
  isAdminVerifier,                       // Restrict to admin users
  clearCache,                  // Clear cache after status update
  OrderController.updateOrderStatus // Handle status update
);

/**
 * @swagger
 * /api/v1/orders/{orderId}/cancel:
 *   put:
 *     summary: Cancel an order and issue store credit (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema: { type: string }
 *         description: The ID of the order
 *     responses:
 *       200:
 *         description: Order cancelled and store credit issued
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 *       404:
 *         description: Order not found
 */
router.put(
  "/:orderId/cancel",
  authenticationVerifier,                // Verify user authentication
  isAdminVerifier,                       // Restrict to admin users
  clearCache,                  // Clear cache after cancellation
  OrderController.cancelOrderAndIssueStoreCredit // Handle cancellation and credit issuance
);

/**
 * @swagger
 * /api/v1/orders/income:
 *   get:
 *     summary: Calculate total income from orders (Admin only)
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total income calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type: { type: string, example: "success" }
 *                 message: { type: string, example: "Total income calculated successfully" }
 *                 data: { type: object, properties: { totalIncome: { type: number }, breakdown: { type: object } } }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (non-admin)
 */
router.get(
  "/income",
  authenticationVerifier,                // Verify user authentication
  isAdminVerifier,                       // Restrict to admin users
  cacheMiddleware,  // Cache income data for 10 minutes
  OrderController.getIncome // Handle income calculation
);

/**
 * @swagger
 * /api/v1/orders/store-credit:
 *   get:
 *     summary: Retrieve user's store credit
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Store credit retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type: { type: string, example: "success" }
 *                 message: { type: string, example: "Store credit retrieved successfully" }
 *                 data: { type: object, properties: { storeCredit: { type: object } } }
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/store-credit",
  authenticationVerifier,                // Verify user authentication
  cacheMiddleware,  // Cache store credit for 5 minutes
  OrderController.getStoreCredit // Handle store credit retrieval
);

export default router;
