import { Router } from 'express';
import {
    listPages,
    getPage,
    createPage,
    updatePage,
    togglePageStatus,
    deletePage
} from '../controllers/adminPage.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

const router = Router();

// Protect all admin static page operations with JWT Bearer auth
router.use(adminAuthMiddleware);

router.get('/', listPages);
router.get('/:id', getPage);
router.post('/', createPage);
router.put('/:id', updatePage);
router.patch('/:id/status', togglePageStatus);
router.delete('/:id', deletePage);

export default router;
