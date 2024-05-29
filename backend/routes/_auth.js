import express from 'express';
import { AuthController } from '../controllers/index.js';

const router = express.Router();

router.post('/register', AuthController.create_user);
router.post('/login', AuthController.login_user);

export default router;
