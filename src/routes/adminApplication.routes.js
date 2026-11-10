import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
    listApplications,
    getApplication,
    createApplication,
    updateApplication,
    deleteApplication,
    toggleApplicationStatus
} from '../controllers/adminApplication.controller.js';

const router = Router();

router.use(adminAuth);

router.get('/', listApplications);
router.get('/:id', getApplication);
router.post('/', uploadSingle('image'), createApplication);
router.put('/:id', uploadSingle('image'), updateApplication);
router.delete('/:id', deleteApplication);
router.patch('/:id/toggle-status', toggleApplicationStatus);

export default router;
