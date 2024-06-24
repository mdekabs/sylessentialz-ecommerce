// routes/shippingRoutes.js
import express from 'express';
import ShippingController from '../controllers/_shippingController.js';
import { authenticationVerifier, isAdminVerifier } from "../middlewares/_verifyToken.js";
const router = express.Router();

router.post('/create', isAdminVerifier, ShippingController.createShipment);
router.get('/:id', authenticationVerifier, ShippingController.getShipment);
router.put('/:id', isAdminVerifier, ShippingController.updateShipment);
router.delete('/:id', isAdminVerifier, ShippingController.deleteShipment);

export default router;
