import express from 'express';
import { CartController } from '../controllers/index.js';
import { authenticationVerifier, accessLevelVerifier, isAdminVerifier } from '../middlewares/_verifyToken.js';

const router = express.Router();

router.get('/', isAdminVerifier, CartController.get_carts);
router.get('/my-cart', authenticationVerifier, CartController.get_cart);
router.post('/', authenticationVerifier, CartController.create_cart);
router.put('/:id', accessLevelVerifier, CartController.update_cart);
router.delete('/:id', accessLevelVerifier, CartController.delete_cart);

export default router;
