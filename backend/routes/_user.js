import express from 'express';
import { accessLevelVerifier, isAdminVerifier } from '../middlewares/_verifyToken.js';
import { UserController } from '../controllers/index.js';

const router = express.Router();

router.get('/', isAdminVerifier, UserController.get_users);
router.get('/:id', isAdminVerifier, UserController.get_user);
router.get('/stats', isAdminVerifier, UserController.get_stats);
router.put('/:id', accessLevelVerifier, UserController.update_user);
router.delete('/:id', isAdminVerifier, UserController.delete_user);

export default router;
