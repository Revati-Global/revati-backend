import { Router } from 'express';
import {
    listServices,
    getService,
    createService,
    updateService,
    toggleServiceStatus,
    deleteService
} from '../controllers/adminService.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protect all admin service operations with JWT Bearer auth
router.use(adminAuthMiddleware);

router.get('/', listServices);
router.get('/:id', getService);
router.post('/', upload.single('image'), createService);
router.put('/:id', upload.single('image'), updateService);
router.patch('/:id/status', toggleServiceStatus);
router.delete('/:id', deleteService);

export default router;
