import express from 'express';
import { ProductController } from '../controllers/index.js';
import { isAdminVerifier, accessLevelVerifier, authenticationVerifier, pagination, clearCache, cacheMiddleware } from '../middlewares/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Products
 *   description: Product management
 */

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Get all products
 *     description: Retrieve a paginated list of products with optional sorting and filtering by new or category.
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of products per page
 *       - in: query
 *         name: new
 *         schema:
 *           type: boolean
 *         description: Filter to get the newest products (limits to 5)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by product category
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
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Successfully retrieved list of products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: 
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalItems:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasMorePages:
 *                           type: boolean
 *                         links:
 *                           type: object
 *       500:
 *         description: Internal server error
 */
router.get('/', pagination, cacheMiddleware, ProductController.getProducts);

/**
 * @swagger
 * /products/{id}:
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
 *         description: The product ID (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Successfully retrieved the product
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     product:
 *                       $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid product ID format
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authenticationVerifier, cacheMiddleware, ProductController.getProduct);

/**
 * @swagger
 * /products:
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               image:
 *                 type: string
 *               stock:
 *                 type: number
 *                 default: 0
 *             required:
 *               - name
 *               - description
 *               - price
 *               - category
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     savedProduct:
 *                       $ref: '#/components/schemas/Product'
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - accessToken: []
 */
router.post('/', authenticationVerifier, isAdminVerifier, clearCache, ProductController.createProduct);

/**
 * @swagger
 * /products/{id}:
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
 *         description: The product ID (MongoDB ObjectId)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *               image:
 *                 type: string
 *               stock:
 *                 type: number
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     updatedProduct:
 *                       $ref: '#/components/schemas/Product'
 *       400:
 *         description: Invalid product ID format
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Product not found
 *       409:
 *         description: Concurrency conflict - Product modified by another request
 *       500:
 *         description: Internal server error
 *     security:
 *       - accessToken: []
 */
router.put('/:id', authenticationVerifier, isAdminVerifier, clearCache, ProductController.updateProduct);

/**
 * @swagger
 * /products/{id}:
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
 *         description: The product ID (MongoDB ObjectId)
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       400:
 *         description: Invalid product ID format
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Product not found
 *       409:
 *         description: Concurrency conflict - Product modified by another request
 *       500:
 *         description: Internal server error
 *     security:
 *       - accessToken: []
 */
router.delete('/:id', authenticationVerifier, isAdminVerifier, clearCache, ProductController.deleteProduct);

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         price:
 *           type: number
 *         category:
 *           type: string
 *         image:
 *           type: string
 *         stock:
 *           type: number
 *         version:
 *           type: number
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

export default router;
