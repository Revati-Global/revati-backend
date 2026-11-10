import { Router } from 'express';
import { submitContact } from '../controllers/contact.controller.js';
import { publicFormLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/', publicFormLimiter, submitContact);

export default router;
