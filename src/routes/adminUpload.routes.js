import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    signUpload,
    confirmUpload,
    getStorageUsage
} from '../controllers/adminUpload.controller.js';

const router = Router();

router.use(adminAuth);

// Direct signed upload endpoints (super admin, admin, editor)
router.post('/sign', authorizeRoles('super admin', 'admin', 'editor'), signUpload);
router.post('/confirm', authorizeRoles('super admin', 'admin', 'editor'), confirmUpload);

// Storage monitor (super admin only)
router.get('/usage', authorizeRoles('super admin'), getStorageUsage);

export default router;
