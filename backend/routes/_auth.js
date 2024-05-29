import express from 'express';
import { AuthController } from '../controllers/index.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: The user's email
 *               username:
 *                 type: string
 *                 description: The user's username
 *               password:
 *                 type: string
 *                 description: The user's password
 *                 format: password
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Bad request - Invalid input data
 *       500:
 *         description: Internal server error
 */
router.post('/register', AuthController.create_user);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login as an existing user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: The user's username
 *               password:
 *                 type: string
 *                 description: The user's password
 *                 format: password
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       401:
 *         description: Unauthorized - Invalid username or password
 *       500:
 *         description: Internal server error
 */
router.post('/login', AuthController.login_user);

export default router;
