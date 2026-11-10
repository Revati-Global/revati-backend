import { uploadAndOptimizeMedia } from '../helpers/mediaOptimizer.js';
import { query } from '../config/db.js';
import { supabase, BUCKET_NAME } from '../config/supabase.js';
import { getImageUrl } from '../helpers/serializers.js';
import { randomUUID } from 'crypto';

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

async function uploadFileToSupabase(file, folder = 'media') {
    if (!file) return null;
    return await uploadAndOptimizeMedia(file, folder);
}

// ================= BLOG CATEGORIES =================

export async function listBlogCategories(req, res, next) {
    try {
        const { rows: categories } = await query(`
            SELECT bc.*,
                   (SELECT COUNT(*) FROM public.blogs b WHERE b.category_id = bc.id) as blog_count
            FROM public.blog_categories bc
            ORDER BY bc.id ASC
        `);

        const formatted = categories.map(c => ({
            id: c.id,
            slug: c.slug,
            title: c.title,
            status: c.status ?? 1,
            image: c.image ? getImageUrl(c.image, 'categories') : null,
            raw_image: c.image,
            description: c.description,
            seo_title: c.seo_title,
            seo_keyword: c.seo_keyword,
            seo_description: c.seo_description,
            blog_count: parseInt(c.blog_count || 0),
            created_at: c.created_at,
            updated_at: c.updated_at
        }));

        return res.json({ result: 'success', categories: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getBlogCategory(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: categories } = await query(
            `SELECT * FROM public.blog_categories WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (categories.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Blog category not found' });
        }
        const c = categories[0];
        return res.json({
            result: 'success',
            category: {
                ...c,
                image_url: c.image ? getImageUrl(c.image, 'categories') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createBlogCategory(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.blog_categories WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        let imageFilename = body.image || null;
        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'categories');
        }

        const { rows: inserted } = await query(
            `INSERT INTO public.blog_categories (
                slug, user_id, title, status, image, description,
                seo_title, seo_keyword, seo_description, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                body.status !== undefined ? parseInt(body.status) : 1,
                imageFilename,
                body.description || null,
                body.seo_title || null,
                body.seo_keyword || null,
                body.seo_description || null
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Blog category created successfully',
            category: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateBlogCategory(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.blog_categories WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Blog category not found' });
        }

        const prev = existing[0];
        let imageFilename = prev.image;

        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'categories');
        } else if (body.image !== undefined) {
            imageFilename = body.image || null;
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.blog_categories WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const { rows: updated } = await query(
            `UPDATE public.blog_categories SET
                title = $1,
                slug = $2,
                image = $3,
                description = $4,
                status = $5,
                seo_title = $6,
                seo_keyword = $7,
                seo_description = $8,
                updated_at = NOW()
            WHERE id = $9
            RETURNING *`,
            [
                title,
                slug,
                imageFilename,
                body.description !== undefined ? body.description : prev.description,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                body.seo_title !== undefined ? body.seo_title : prev.seo_title,
                body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
                body.seo_description !== undefined ? body.seo_description : prev.seo_description,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Blog category updated successfully',
            category: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteBlogCategory(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image FROM public.blog_categories WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Blog category not found' });
        }

        if (existing[0].image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`categories/${existing[0].image}`]);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on blog category delete:', storageErr.message);
            }
        }

        // Reassign blogs with this category to NULL
        await query(`UPDATE public.blogs SET category_id = NULL WHERE category_id = $1`, [id]);
        await query(`DELETE FROM public.blog_categories WHERE id = $1`, [id]);

        return res.json({ result: 'success', message: 'Blog category deleted successfully' });
    } catch (err) {
        next(err);
    }
}

// ================= BLOGS / ARTICLES =================

export async function listBlogs(req, res, next) {
    try {
        const { search, category_id, status } = req.query;
        let sql = `
            SELECT b.*,
                   bc.title as category_title,
                   bc.slug as category_slug
            FROM public.blogs b
            LEFT JOIN public.blog_categories bc ON bc.id = b.category_id
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (b.title ILIKE $${params.length} OR b.slug ILIKE $${params.length} OR b.summary ILIKE $${params.length})`;
        }

        if (category_id && category_id !== 'all') {
            params.push(parseInt(category_id));
            sql += ` AND b.category_id = $${params.length}`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND b.status = $${params.length}`;
        }

        sql += ` ORDER BY b.id DESC`;

        const { rows: blogs } = await query(sql, params);

        const formatted = blogs.map(b => ({
            id: b.id,
            slug: b.slug,
            title: b.title,
            category_id: b.category_id,
            category_title: b.category_title || 'Uncategorized',
            category_slug: b.category_slug || null,
            image: b.image ? getImageUrl(b.image, 'blogs') : null,
            raw_image: b.image,
            summary: b.summary,
            description: b.description,
            status: b.status ?? 1,
            seo_title: b.seo_title,
            seo_keyword: b.seo_keyword,
            seo_description: b.seo_description,
            created_at: b.created_at,
            updated_at: b.updated_at
        }));

        return res.json({ result: 'success', blogs: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getBlog(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: blogs } = await query(
            `SELECT b.*,
                    bc.title as category_title,
                    bc.slug as category_slug
             FROM public.blogs b
             LEFT JOIN public.blog_categories bc ON bc.id = b.category_id
             WHERE b.id = $1 LIMIT 1`,
            [id]
        );

        if (blogs.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Blog not found' });
        }

        const b = blogs[0];
        return res.json({
            result: 'success',
            blog: {
                ...b,
                image_url: b.image ? getImageUrl(b.image, 'blogs') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createBlog(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Blog title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.blogs WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        let imageFilename = body.image || null;
        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'blogs');
        }

        const categoryId = body.category_id ? parseInt(body.category_id) : null;

        const { rows: inserted } = await query(
            `INSERT INTO public.blogs (
                slug, user_id, category_id, title, summary,
                description, image, status,
                seo_title, seo_keyword, seo_description,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11,
                NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                categoryId,
                body.title.trim(),
                body.summary || null,
                body.description || null,
                imageFilename,
                body.status !== undefined ? parseInt(body.status) : 1,
                body.seo_title || null,
                body.seo_keyword || null,
                body.seo_description || null
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Blog article created successfully',
            blog: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateBlog(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.blogs WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Blog not found' });
        }

        const prev = existing[0];
        let imageFilename = prev.image;

        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'blogs');
        } else if (body.image !== undefined) {
            imageFilename = body.image || null;
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.blogs WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const categoryId = body.category_id !== undefined ? (body.category_id ? parseInt(body.category_id) : null) : prev.category_id;

        const { rows: updated } = await query(
            `UPDATE public.blogs SET
                title = $1,
                slug = $2,
                category_id = $3,
                summary = $4,
                description = $5,
                image = $6,
                status = $7,
                seo_title = $8,
                seo_keyword = $9,
                seo_description = $10,
                updated_at = NOW()
            WHERE id = $11
            RETURNING *`,
            [
                title,
                slug,
                categoryId,
                body.summary !== undefined ? body.summary : prev.summary,
                body.description !== undefined ? body.description : prev.description,
                imageFilename,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                body.seo_title !== undefined ? body.seo_title : prev.seo_title,
                body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
                body.seo_description !== undefined ? body.seo_description : prev.seo_description,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Blog article updated successfully',
            blog: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleBlogStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: blogs } = await query(
            `SELECT id, status FROM public.blogs WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (blogs.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Blog not found' });
        }

        const newStatus = blogs[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.blogs SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({
            result: 'success',
            message: `Blog ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteBlog(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image FROM public.blogs WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Blog not found' });
        }

        const blog = existing[0];
        if (blog.image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`blogs/${blog.image}`]);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on blog delete:', storageErr.message);
            }
        }

        await query(`DELETE FROM public.blogs WHERE id = $1`, [id]);

        return res.json({ result: 'success', message: 'Blog deleted successfully' });
    } catch (err) {
        next(err);
    }
}
