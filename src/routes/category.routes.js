import { Router } from 'express';
import {
    getCategories,
    getCategoryBySlug,
    getCategoryList
} from '../controllers/category.controller.js';

const router = Router();

// Routes matching Laravel routes/api.php
router.get('/', getCategories);
router.get('/:category', getCategoryBySlug);
router.get('/:category/list', getCategoryList);

export default router;
