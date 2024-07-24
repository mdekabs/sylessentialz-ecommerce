import express from 'express';
import ReviewController from '../controllers/_reviewController.js';
import { isAdminVerifier, authenticationVerifier, accessLevelVerifier } from '../middlewares/_verifyToken.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Review management
 */

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Create a new review
 *     description: Create a new review for a product. User authentication required.
 *     tags: [Reviews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *             required:
 *               - productId
 *               - rating
 *               - comment
 *     responses:
 *       201:
 *         description: Review created successfully
 *       401:
 *         description: Unauthorized - User authentication required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticationVerifier, ReviewController.create_review);

/**
 * @swagger
 * /reviews/{productId}:
 *   get:
 *     summary: Get all reviews for a product
 *     description: Retrieve all reviews for a specific product
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: productId
 *         schema:
 *           type: string
 *         required: true
 *         description: The product ID
 *     responses:
 *       200:
 *         description: Successfully retrieved the reviews
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.get('/:productId', ReviewController.get_reviews);

/**
 * @swagger
 * /reviews/{reviewId}:
 *   put:
 *     summary: Update a review
 *     description: Update an existing review by its ID. User authentication required.
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         schema:
 *           type: string
 *         required: true
 *         description: The review ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Review updated successfully
 *       401:
 *         description: Unauthorized - User authentication required
 *       403:
 *         description: Forbidden - User not authorized to update this review
 *       404:
 *         description: Review not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.put('/:reviewId', authenticationVerifier, ReviewController.update_review);

/**
 * @swagger
 * /reviews/{reviewId}:
 *   delete:
 *     summary: Delete a review
 *     description: Delete a review by its ID. User authentication required.
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         schema:
 *           type: string
 *         required: true
 *         description: The review ID
 *     responses:
 *       200:
 *         description: Review deleted successfully
 *       401:
 *         description: Unauthorized - User authentication required
 *       403:
 *         description: Forbidden - User not authorized to delete this review
 *       404:
 *         description: Review not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:reviewId', authenticationVerifier, ReviewController.delete_review);

export default router;
