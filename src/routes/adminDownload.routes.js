import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
    listDownloads,
    getDownload,
    createDownload,
    updateDownload,
    deleteDownload,
    toggleDownloadStatus
} from '../controllers/adminDownload.controller.js';

const router = Router();

router.use(adminAuth);

router.get('/', listDownloads);
router.get('/:id', getDownload);
router.post('/', uploadSingle('file'), createDownload);
router.put('/:id', uploadSingle('file'), updateDownload);
router.delete('/:id', deleteDownload);
router.patch('/:id/toggle-status', toggleDownloadStatus);

export default router;

