import { Router } from 'express';
import { login, me, logout } from '../controllers/adminAuth.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Public auth endpoints (brute force protected)
router.post('/login', authLimiter, login);

// Protected auth endpoints
router.get('/me', adminAuthMiddleware, me);
router.post('/logout', adminAuthMiddleware, logout);

export default router;
