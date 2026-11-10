import { Router } from 'express';
import {
    listFeatures,
    getFeature,
    createFeature,
    updateFeature,
    toggleFeatureStatus,
    deleteFeature
} from '../controllers/adminFeature.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protect all admin feature operations with JWT Bearer auth
router.use(adminAuthMiddleware);

router.get('/', listFeatures);
router.get('/:id', getFeature);
router.post('/', upload.single('image'), createFeature);
router.put('/:id', upload.single('image'), updateFeature);
router.patch('/:id/status', toggleFeatureStatus);
router.delete('/:id', deleteFeature);

export default router;
