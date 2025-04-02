import express from 'express';
import { AuthController } from '../controllers/index.js';
import { authenticationVerifier } from "../middlewares/index.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and guest access
 */

/**
 * @swagger
 * /auth/guest:
 *   post:
 *     summary: Generate a guest user ID and token
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Guest ID and token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Guest ID and token generated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     guestId:
 *                       type: string
 *                       description: Unique guest identifier
 *                       example: 550e8400-e29b-41d4-a716-446655440000
 *                     token:
 *                       type: string
 *                       description: JWT token for guest access
 *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       500:
 *         description: Internal server error
 */
router.post('/guest', AuthController.generateGuestId);

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
 *       409:
 *         description: Conflict - Email already in use
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Successfully logged in
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     isAdmin:
 *                       type: boolean
 *                     accessToken:
 *                       type: string
 *       401:
 *         description: Unauthorized - Invalid username or password
 *       403:
 *         description: Forbidden - Account locked
 *       500:
 *         description: Internal server error
 */
router.post('/login', AuthController.login_user);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout a user and blacklist their token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/logout', authenticationVerifier, AuthController.logout_user);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Send reset password email
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
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post('/forgot-password', AuthController.forgot_password);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset user password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: The password reset token
 *               newPassword:
 *                 type: string
 *                 description: The new password
 *                 format: password
 *     responses:
 *       200:
 *         description: Password has been reset successfully
 *       400:
 *         description: Bad request - Invalid or expired token
 *       500:
 *         description: Internal server error
 */
router.post('/reset-password', AuthController.reset_password);

export default router;
