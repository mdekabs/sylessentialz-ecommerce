import express from 'express';
import { SearchController } from '../controllers/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Search for products
 */

/**
 * @swagger
 * /api/v1/products/search:
 *   get:
 *     summary: Search for products
 *     description: Search for products based on a query string
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: true
 *         description: The search query string
 *     responses:
 *       200:
 *         description: Successfully retrieved the search results
 *       400:
 *         description: Bad request
 *       500:
 *         description: Internal server error
 */
router.get('/search', SearchController.search);

export default router;
