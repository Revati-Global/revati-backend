import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    getCleanupSummary,
    searchCleanupData,
    bulkDeleteRecords,
    scanOrphanFiles,
    purgeOrphanFiles
} from '../controllers/adminCleanup.controller.js';

const router = Router();

router.use(adminAuth);
// Super Admin only for cleanup suite
router.use(authorizeRoles('super admin'));

router.get('/summary', getCleanupSummary);
router.get('/search', searchCleanupData);
router.post('/delete', bulkDeleteRecords);
router.get('/orphans', scanOrphanFiles);
router.post('/orphans/purge', purgeOrphanFiles);

export default router;
