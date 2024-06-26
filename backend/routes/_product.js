import express from 'express';
import { ProductController } from '../controllers/index.js';
import { isAdminVerifier } from '../middlewares/_verifyToken.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management
 */

/**
 * @swagger
 * /api/v1/products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve a list of all products
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Successfully retrieved list of products
 *       500:
 *         description: Internal server error
 */
router.get('/', ProductController.get_products);

/**
 * @swagger
 * /api/v1/products/search:
 *   get:
 *     summary: Search for products
 *     description: Search for products by query
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: The search query
 *     responses:
 *       200:
 *         description: Successfully retrieved search results
 *       500:
 *         description: Internal server error
 */
router.get('/search', ProductController.search_products);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   get:
 *     summary: Get a single product
 *     description: Retrieve a single product by its ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Successfully retrieved the product
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', ProductController.get_product);

/**
 * @swagger
 * /api/v1/products:
 *   post:
 *     summary: Create a new product
 *     description: Create a new product. Admin access required.
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               size:
 *                 type: string
 *               color:
 *                 type: string
 *               price:
 *                 type: number
 *             required:
 *               - title
 *               - description
 *               - image
 *               - price
 *     responses:
 *       201:
 *         description: Product created successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - accessToken: []
 */
router.post('/', isAdminVerifier, ProductController.create_product);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   put:
 *     summary: Update a product
 *     description: Update an existing product by its ID. Admin access required.
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               size:
 *                 type: string
 *               color:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - accessToken: []
 */
router.put('/:id', isAdminVerifier, ProductController.update_product);

/**
 * @swagger
 * /api/v1/products/{id}:
 *   delete:
 *     summary: Delete a product
 *     description: Delete a product by its ID. Admin access required.
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - accessToken: []
 */
router.delete('/:id', isAdminVerifier, ProductController.delete_product);

export default router;
