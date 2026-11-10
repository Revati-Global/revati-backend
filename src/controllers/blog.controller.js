import { query } from '../config/db.js';
import {
    serializeBlogs,
    serializeBlogDetail,
    serializeBlogCategories,
    serializeBlogCategoryDetail
} from '../helpers/serializers.js';

export async function getBlogs(req, res, next) {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : null;

        let sql = `SELECT * FROM public."blogs" WHERE status = 1 ORDER BY "id" DESC`;
        const params = [];

        if (limit && !isNaN(limit) && limit > 0) {
            sql += ` LIMIT $1`;
            params.push(limit);
        }

        const { rows: blogs } = await query(sql, params);
        const { rows: categories } = await query(`SELECT * FROM public."blog_categories" WHERE status = 1`);

        const serialized = serializeBlogs(blogs, categories);

        return res.json({
            result: 'success',
            blogs: serialized
        });
    } catch (err) {
        next(err);
    }
}

export async function getBlogBySlug(req, res, next) {
    try {
        const { blog: slug } = req.params;

        const { rows: blogs } = await query(
            `SELECT * FROM public."blogs" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (blogs.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Blog not found'
            });
        }

        const blog = blogs[0];

        // Fetch recent 5 blogs except current
        const { rows: recentBlogs } = await query(
            `SELECT * FROM public."blogs" WHERE status = 1 AND id != $1 ORDER BY "id" DESC LIMIT 5`,
            [blog.id]
        );

        // Fetch categories and all active blogs for counting
        const { rows: categories } = await query(
            `SELECT * FROM public."blog_categories" WHERE status = 1 ORDER BY "id" DESC`
        );
        const { rows: allActiveBlogs } = await query(
            `SELECT id, category_id, status FROM public."blogs" WHERE status = 1`
        );

        const currentCategory = categories.find(c => c.id === blog.category_id) || null;

        const serializedBlog = serializeBlogDetail(blog, currentCategory);
        const serializedRecentBlogs = serializeBlogs(recentBlogs, categories);
        const serializedCategories = serializeBlogCategories(categories, allActiveBlogs);

        return res.json({
            result: 'success',
            blog: serializedBlog,
            blogs: serializedRecentBlogs,
            categories: serializedCategories
        });
    } catch (err) {
        next(err);
    }
}

export async function getBlogsByCategory(req, res, next) {
    try {
        const { blog_category: slug } = req.params;

        const { rows: categories } = await query(
            `SELECT * FROM public."blog_categories" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (categories.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Blog category not found'
            });
        }

        const category = categories[0];

        const { rows: blogs } = await query(
            `SELECT * FROM public."blogs" WHERE category_id = $1 AND status = 1 ORDER BY "id" DESC`,
            [category.id]
        );

        const serializedBlogs = serializeBlogs(blogs, [category]);
        const serializedCategory = serializeBlogCategoryDetail(category, 0);

        return res.json({
            result: 'success',
            blogs: serializedBlogs,
            category: serializedCategory
        });
    } catch (err) {
        next(err);
    }
}
