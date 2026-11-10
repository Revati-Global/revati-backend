import { Router } from 'express';
import {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    toggleCategoryStatus,
    deleteCategory
} from '../controllers/adminCategory.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protect all admin category operations with JWT Bearer auth
router.use(adminAuthMiddleware);

router.get('/', listCategories);
router.get('/:id', getCategory);
router.post('/', upload.single('image'), createCategory);
router.put('/:id', upload.single('image'), updateCategory);
router.patch('/:id/status', toggleCategoryStatus);
router.delete('/:id', deleteCategory);

export default router;
