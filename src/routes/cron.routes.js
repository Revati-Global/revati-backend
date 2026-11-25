import { Router } from 'express';
import { cronKeepalive } from '../controllers/cron.controller.js';

const router = Router();

router.get('/keepalive', cronKeepalive);

export default router;
