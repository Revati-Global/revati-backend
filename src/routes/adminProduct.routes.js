import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct
} from '../controllers/adminProduct.controller.js';

const router = Router();

router.use(adminAuth);
router.use(authorizeRoles('super admin', 'admin', 'editor'));

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', createProduct);
router.put('/:id', updateProduct);
router.patch('/:id/status', toggleProductStatus);
router.delete('/:id', deleteProduct);

export default router;
