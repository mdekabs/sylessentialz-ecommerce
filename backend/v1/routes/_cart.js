import express from 'express';
import { CartController } from '../controllers/index.js';
import { authenticationVerifier, accessLevelVerifier, isAdminVerifier, optionalVerifier, cacheMiddleware, pagination, clearCache } from '../middlewares/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Carts
 *   description: Cart management and retrieval
 */

/**
 * @swagger
 * /carts:
 *   get:
 *     summary: Get all carts
 *     description: Retrieve all carts (admin only)
 *     tags: [Carts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Carts retrieved successfully
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/', isAdminVerifier, pagination, cacheMiddleware, CartController.getCarts);

/**
 * @swagger
 * /carts/my-cart:
 *   get:
 *     summary: Get current user's or guest's cart
 *     description: Retrieve the cart of the authenticated user or guest (via token or guestId)
 *     tags: [Carts]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guestId:
 *                 type: string
 *                 description: Guest ID (optional if token provided)
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       400:
 *         description: Bad request - No identifier provided
 *       401:
 *         description: Unauthorized - Invalid token (if provided)
 *       404:
 *         description: Cart not found or expired
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-cart', optionalVerifier, cacheMiddleware, CartController.getCart);

/**
 * @swagger
 * /carts/{id}:
 *   get:
 *     summary: Get cart by ID
 *     description: Retrieve a specific cart by its ID (authenticated users only)
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart ID
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       400:
 *         description: Bad request - Invalid cart ID
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticationVerifier, cacheMiddleware, CartController.getCartById);

/**
 * @swagger
 * /carts:
 *   post:
 *     summary: Create new cart
 *     description: Create a new cart for the authenticated user
 *     tags: [Carts]
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
 *     responses:
 *       201:
 *         description: Cart created successfully
 *       400:
 *         description: Bad request - Invalid products array
 *       401:
 *         description: Unauthorized - Authentication required
 *       409:
 *         description: Conflict - Cart already exists
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticationVerifier, clearCache, CartController.createCart);

/**
 * @swagger
 * /carts/{id}:
 *   put:
 *     summary: Update cart
 *     description: Update the authenticated user's cart
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart ID
 *     requestBody:
 *       required: false
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
 *     responses:
 *       200:
 *         description: Cart updated successfully
 *       400:
 *         description: Bad request - Invalid product format
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Not authorized to update this cart
 *       404:
 *         description: Cart not found
 *       409:
 *         description: Conflict - Concurrency issue
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', accessLevelVerifier, clearCache, CartController.updateCart);

/**
 * @swagger
 * /carts/add:
 *   post:
 *     summary: Add item to cart
 *     description: Add a product to the authenticated user's or guest's cart
 *     tags: [Carts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *                 default: 1
 *               guestId:
 *                 type: string
 *                 description: Guest ID (optional if token provided)
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 *       400:
 *         description: Bad request - Invalid productId, quantity, or no identifier
 *       401:
 *         description: Unauthorized - Invalid token (if provided)
 *       409:
 *         description: Conflict - Concurrency issue
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/add', optionalVerifier, clearCache, CartController.addToCart);

/**
 * @swagger
 * /carts/remove:
 *   post:
 *     summary: Remove item from cart
 *     description: Remove a product from the authenticated user's or guest's cart
 *     tags: [Carts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               guestId:
 *                 type: string
 *                 description: Guest ID (optional if token provided)
 *     responses:
 *       200:
 *         description: Item removed from cart successfully
 *       400:
 *         description: Bad request - Invalid productId or no identifier
 *       401:
 *         description: Unauthorized - Invalid token (if provided)
 *       404:
 *         description: Product or cart not found
 *       409:
 *         description: Conflict - Concurrency issue
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/remove', optionalVerifier, clearCache, CartController.removeFromCart);

/**
 * @swagger
 * /carts/clear:
 *   post:
 *     summary: Clear cart
 *     description: Remove all items from the authenticated user's or guest's cart
 *     tags: [Carts]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               guestId:
 *                 type: string
 *                 description: Guest ID (optional if token provided)
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       400:
 *         description: Bad request - No identifier provided
 *       401:
 *         description: Unauthorized - Invalid token (if provided)
 *       404:
 *         description: Cart not found
 *       409:
 *         description: Conflict - Concurrency issue
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/clear', optionalVerifier, clearCache, CartController.clearCart);

export default router;
