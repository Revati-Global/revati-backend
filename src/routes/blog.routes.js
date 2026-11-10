import { Router } from 'express';
import {
    getBlogs,
    getBlogBySlug,
    getBlogsByCategory
} from '../controllers/blog.controller.js';

const router = Router();

// Order matters: 'categories/:blog_category' must precede '/:blog' so 'categories' is not captured as :blog
router.get('/categories/:blog_category', getBlogsByCategory);
router.get('/', getBlogs);
router.get('/:blog', getBlogBySlug);

export default router;
