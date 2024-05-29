import express from 'express';
import { CartController } from '../controllers/index.js';
import { authenticationVerifier, accessLevelVerifier, isAdminVerifier } from '../middlewares/_verifyToken.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Carts
 *   description: Cart management and retrieval
 */

/**
 * @swagger
 * /api/v1/carts:
 *   get:
 *     summary: Get all carts
 *     description: Retrieve all carts (admin only)
 *     tags: [Carts]
 *     responses:
 *       200:
 *         description: Carts retrieved successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/', isAdminVerifier, CartController.get_carts);

/**
 * @swagger
 * /api/v1/carts/my-cart:
 *   get:
 *     summary: Get current user's cart
 *     description: Retrieve the cart of the currently authenticated user
 *     tags: [Carts]
 *     responses:
 *       200:
 *         description: Cart retrieved successfully
 *       401:
 *         description: Unauthorized - User access required
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/my-cart', authenticationVerifier, CartController.get_cart);

/**
 * @swagger
 * /api/v1/carts:
 *   post:
 *     summary: Add product to cart
 *     description: Add a new product to the cart. The userId is obtained from the authenticated user's token.
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
 *         description: Product added successfully
 *       401:
 *         description: Unauthorized - User access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticationVerifier, CartController.create_cart);

/**
 * @swagger
 * /api/v1/carts/{id}:
 *   put:
 *     summary: Update cart
 *     description: Update the cart with the specified ID
 *     tags: [Carts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The cart ID
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
 *     responses:
 *       200:
 *         description: Cart updated successfully
 *       401:
 *         description: Unauthorized - User or admin access required
 *       403:
 *         description: Forbidden - You are not allowed to perform this task
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', accessLevelVerifier, CartController.update_cart);

/**
 * @swagger
 * /api/v1/carts/{id}:
 *   delete:
 *     summary: Delete cart
 *     description: Delete the cart with the specified ID
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
 *         description: Cart deleted successfully
 *       401:
 *         description: Unauthorized - User or admin access required
 *       403:
 *         description: Forbidden - You are not allowed to perform this task
 *       404:
 *         description: Cart not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', accessLevelVerifier, CartController.delete_cart);

export default router;
