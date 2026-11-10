import { Router } from 'express';
import {
    listIndustries,
    getIndustry,
    createIndustry,
    updateIndustry,
    toggleIndustryStatus,
    deleteIndustry
} from '../controllers/adminIndustry.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protect all admin industry operations with JWT Bearer auth
router.use(adminAuthMiddleware);

router.get('/', listIndustries);
router.get('/:id', getIndustry);
router.post('/', upload.single('image'), createIndustry);
router.put('/:id', upload.single('image'), updateIndustry);
router.patch('/:id/status', toggleIndustryStatus);
router.delete('/:id', deleteIndustry);

export default router;
