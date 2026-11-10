import { Router } from 'express';
import {
    listBanners,
    getBanner,
    createBanner,
    updateBanner,
    toggleBannerStatus,
    deleteBanner
} from '../controllers/adminBanner.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protect all admin banner operations with JWT Bearer auth
router.use(adminAuthMiddleware);

const bannerUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'icon', maxCount: 1 }
]);

router.get('/', listBanners);
router.get('/:id', getBanner);
router.post('/', bannerUpload, createBanner);
router.put('/:id', bannerUpload, updateBanner);
router.patch('/:id/status', toggleBannerStatus);
router.delete('/:id', deleteBanner);

export default router;
