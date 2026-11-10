import { Router } from 'express';
import {
    listBlogCategories,
    getBlogCategory,
    createBlogCategory,
    updateBlogCategory,
    deleteBlogCategory,
    listBlogs,
    getBlog,
    createBlog,
    updateBlog,
    toggleBlogStatus,
    deleteBlog
} from '../controllers/adminBlog.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import { upload } from '../middleware/upload.js';

const router = Router();

// Protect all admin blog operations with JWT Bearer auth
router.use(adminAuthMiddleware);

// Blog Categories Routes
router.get('/categories', listBlogCategories);
router.get('/categories/:id', getBlogCategory);
router.post('/categories', upload.single('image'), createBlogCategory);
router.put('/categories/:id', upload.single('image'), updateBlogCategory);
router.delete('/categories/:id', deleteBlogCategory);

// Blogs / Articles Routes
router.get('/', listBlogs);
router.get('/:id', getBlog);
router.post('/', upload.single('image'), createBlog);
router.put('/:id', upload.single('image'), updateBlog);
router.patch('/:id/status', toggleBlogStatus);
router.delete('/:id', deleteBlog);

export default router;
