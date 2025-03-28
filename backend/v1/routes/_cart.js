import express from 'express';
import { CartController } from '../controllers/index.js';
import { authenticationVerifier, accessLevelVerifier, isAdminVerifier, cacheMiddleware, pagination, clearCache } from '../middlewares/index.js';


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
router.get('/', isAdminVerifier, pagination, cacheMiddleware, CartController.get_carts);

/**
 * @swagger
 * /carts/my-cart:
 *   get:
 *     summary: Get current user's cart
 *     description: Retrieve the cart of the currently authenticated user
 *     tags: [Carts]
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-cart', authenticationVerifier, cacheMiddleware, CartController.get_cart);

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
router.post('/', authenticationVerifier, clearCache, CartController.create_cart);

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
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', accessLevelVerifier, clearCache, CartController.update_cart);

/**
 * @swagger
 * /carts/add:
 *   post:
 *     summary: Add item to cart
 *     description: Add a product to the authenticated user's cart
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
 *     responses:
 *       200:
 *         description: Item added to cart successfully
 *       400:
 *         description: Bad request - Invalid productId or quantity
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/add', authenticationVerifier, clearCache, CartController.add_to_cart);

/**
 * @swagger
 * /carts/remove:
 *   post:
 *     summary: Remove item from cart
 *     description: Remove a product from the authenticated user's cart
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
 *     responses:
 *       200:
 *         description: Item removed from cart successfully
 *       400:
 *         description: Bad request - Invalid productId
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Product or cart not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/remove', authenticationVerifier, clearCache, CartController.remove_from_cart);

/**
 * @swagger
 * /carts/clear:
 *   post:
 *     summary: Clear cart
 *     description: Remove all items from the authenticated user's cart
 *     tags: [Carts]
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       401:
 *         description: Unauthorized - Authentication required
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/clear', authenticationVerifier, clearCache, CartController.clear_cart);

router.get('/:id', authenticationVerifier, cacheMiddleware, CartController.get_cart_by_id);

export default router;
