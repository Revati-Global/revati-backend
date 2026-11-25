import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    listDownloads,
    getDownload,
    createDownload,
    updateDownload,
    toggleDownloadStatus,
    deleteDownload
} from '../controllers/adminDownload.controller.js';

const router = Router();

router.use(adminAuth);
router.use(authorizeRoles('super admin', 'admin', 'editor'));

router.get('/', listDownloads);
router.get('/:id', getDownload);
router.post('/', createDownload);
router.put('/:id', updateDownload);
router.patch('/:id/status', toggleDownloadStatus);
router.delete('/:id', deleteDownload);

export default router;
