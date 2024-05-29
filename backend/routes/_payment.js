import express from 'express';
import { accessLevelVerifier } from '../middlewares/_verifyToken.js';
import { PaymentController } from '../controllers/index.js';

const router = express.Router();

router.post('/payment', accessLevelVerifier, PaymentController.create_payment);

export default router;
