import { Router } from 'express';
import {
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    toggleProductStatus,
    deleteProduct
} from '../controllers/adminProduct.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protect all admin product operations with JWT Bearer auth
router.use(adminAuthMiddleware);

const productUpload = upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'benefit_image', maxCount: 1 },
    { name: 'catalogue', maxCount: 1 }
]);

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', productUpload, createProduct);
router.put('/:id', productUpload, updateProduct);
router.patch('/:id/status', toggleProductStatus);
router.delete('/:id', deleteProduct);

export default router;
