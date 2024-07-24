import express from 'express';
import ShippingController from '../controllers/_shippingController.js';
import { authenticationVerifier, isAdminVerifier } from "../middlewares/_verifyToken.js";
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Shipping
 *   description: Shipping management and retrieval
 */

/**
 * @swagger
 * /api/v1/shipping/create:
 *   post:
 *     summary: Create a shipment
 *     description: Create a new shipment (admin only)
 *     tags: [Shipping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *                 required: true
 *               shippingAddress:
 *                 type: object
 *                 required: true
 *               status:
 *                 type: string
 *                 default: "pending"
 *     responses:
 *       201:
 *         description: Shipment created successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.post('/create', isAdminVerifier, ShippingController.createShipment);

/**
 * @swagger
 * /api/v1/shipping/{id}:
 *   get:
 *     summary: Get shipment details
 *     description: Retrieve details of a specific shipment
 *     tags: [Shipping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the shipment
 *     responses:
 *       200:
 *         description: Shipment retrieved successfully
 *       401:
 *         description: Unauthorized - User access required
 *       404:
 *         description: Shipment not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticationVerifier, ShippingController.getShipment);

/**
 * @swagger
 * /api/v1/shipping/{id}:
 *   put:
 *     summary: Update shipment details
 *     description: Update the details of a specific shipment (admin only)
 *     tags: [Shipping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the shipment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shippingAddress:
 *                 type: object
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shipment updated successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Shipment not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', isAdminVerifier, ShippingController.updateShipment);

/**
 * @swagger
 * /shipping/{id}:
 *   delete:
 *     summary: Delete shipment
 *     description: Delete a specific shipment (admin only)
 *     tags: [Shipping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the shipment
 *     responses:
 *       200:
 *         description: Shipment deleted successfully
 *       401:
 *         description: Unauthorized - Admin access required
 *       404:
 *         description: Shipment not found
 *       500:
 *         description: Internal server error
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', isAdminVerifier, ShippingController.deleteShipment);

export default router;
