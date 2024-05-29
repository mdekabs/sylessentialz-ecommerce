import express from 'express';
import { ProductController } from '../controllers/index.js';
import { isAdminVerifier } from '../middlewares/_verifyToken.js';

const router = express.Router();

router.get('/', ProductController.get_products);
router.get('/:id', ProductController.get_product);
router.post('/', isAdminVerifier, ProductController.create_product);
router.put('/:id', isAdminVerifier, ProductController.update_product);
router.delete('/:id', isAdminVerifier, ProductController.delete_product);

export default router;
