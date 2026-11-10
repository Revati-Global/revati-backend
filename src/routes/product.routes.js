import { Router } from 'express';
import { getProductBySlug } from '../controllers/product.controller.js';

const router = Router();

// Routes matching Laravel routes/api.php
router.get('/:product', getProductBySlug);

export default router;
