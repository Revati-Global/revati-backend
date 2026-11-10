import { Router } from 'express';
import { subscribe } from '../controllers/subscriber.controller.js';
import { publicFormLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/', publicFormLimiter, subscribe);

export default router;
