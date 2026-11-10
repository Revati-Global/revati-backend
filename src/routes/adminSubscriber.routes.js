import { Router } from 'express';
import {
    listSubscribers,
    exportSubscribersCsv,
    deleteSubscriber
} from '../controllers/adminSubscriber.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

const router = Router();

// Protect all admin subscriber operations with JWT Bearer auth
router.use(adminAuthMiddleware);

router.get('/', listSubscribers);
router.get('/export', exportSubscribersCsv);
router.delete('/:id', deleteSubscriber);

export default router;
