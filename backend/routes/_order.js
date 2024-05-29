import express from 'express';
import { OrderController } from '../controllers/index.js';
import { authenticationVerifier, accessLevelVerifier, isAdminVerifier } from '../middlewares/_verifyToken.js';

const router = express.Router();

router.get('/', isAdminVerifier, OrderController.get_orders);
router.get('/income', isAdminVerifier, OrderController.get_income);
router.get('/:userId', accessLevelVerifier, OrderController.get_order);
router.post('/', authenticationVerifier, OrderController.create_order);
router.put('/:id', isAdminVerifier, OrderController.update_order);
router.delete('/:id', isAdminVerifier, OrderController.delete_order);

export default router;
