import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    listCategories,
    getCategory,
    createCategory,
    updateCategory,
    toggleCategoryStatus,
    deleteCategory
} from '../controllers/adminCategory.controller.js';

const router = Router();

router.use(adminAuth);
router.use(authorizeRoles('super admin', 'admin', 'editor'));

router.get('/', listCategories);
router.get('/:id', getCategory);
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.patch('/:id/status', toggleCategoryStatus);
router.delete('/:id', deleteCategory);

export default router;
