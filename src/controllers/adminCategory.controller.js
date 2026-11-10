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

export async function listCategories(req, res, next) {
    try {
        const { search, parent } = req.query;
        let sql = `
            SELECT c.*, 
                   p.title as parent_title,
                   (SELECT COUNT(*) FROM public.categories sub WHERE sub.parent_category = CAST(c.id AS VARCHAR)) as subcategory_count,
                   (SELECT COUNT(*) FROM public.products pr WHERE pr.category_id = c.id) as product_count
            FROM public.categories c
            LEFT JOIN public.categories p ON CAST(p.id AS VARCHAR) = c.parent_category
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (c.title ILIKE $${params.length} OR c.slug ILIKE $${params.length})`;
        }

        if (parent === 'root') {
            sql += ` AND (c.parent_category IS NULL OR c.parent_category = '' OR c.parent_category = '0')`;
        } else if (parent && parent !== 'all') {
            params.push(parent);
            sql += ` AND c.parent_category = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE(c."order", 9999) ASC, c.id ASC`;

        const { rows: categories } = await query(sql, params);

        const formatted = categories.map(c => ({
            id: c.id,
            slug: c.slug,
            title: c.title,
            parent_category: c.parent_category,
            parent_title: c.parent_title || null,
            image: c.image ? getImageUrl(c.image, 'categories') : null,
            raw_image: c.image,
            description: c.description,
            navigation_status: c.navigation_status ?? 1,
            home_status: c.home_status ?? 1,
            status: c.status ?? 1,
            order: c.order ?? 0,
            seo_title: c.seo_title,
            seo_keyword: c.seo_keyword,
            seo_description: c.seo_description,
            subcategory_count: parseInt(c.subcategory_count || 0),
            product_count: parseInt(c.product_count || 0),
            created_at: c.created_at,
            updated_at: c.updated_at
        }));

        return res.json({
            result: 'success',
            categories: formatted
        });
    } catch (err) {
        next(err);
    }
}

export async function getCategory(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: categories } = await query(
            `SELECT * FROM public.categories WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (categories.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Category not found' });
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

export async function createCategory(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({
                result: 'error',
                message: 'Category title is required'
            });
        }

        let categorySlug = body.slug ? slugify(body.slug) : slugify(body.title);
        
        // Ensure slug uniqueness
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.categories WHERE slug = $1 LIMIT 1`,
            [categorySlug]
        );
        if (existingSlug.length > 0) {
            categorySlug = `${categorySlug}-${Date.now()}`;
        }

        let imageFilename = body.image || null;

        // Handle file upload if present
        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'categories');
        }

        const parentCategory = body.parent_category && body.parent_category !== '0' && body.parent_category !== ''
            ? String(body.parent_category)
            : null;

        const { rows: inserted } = await query(
            `INSERT INTO public.categories (
                slug, user_id, title, parent_category, image, description,
                navigation_status, home_status, seo_title, seo_keyword, seo_description,
                status, "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                $12, $13, NOW(), NOW()
            ) RETURNING *`,
            [
                categorySlug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                parentCategory,
                imageFilename,
                body.description || null,
                body.navigation_status !== undefined ? parseInt(body.navigation_status) : 1,
                body.home_status !== undefined ? parseInt(body.home_status) : 1,
                body.seo_title || null,
                body.seo_keyword || null,
                body.seo_description || null,
                body.status !== undefined ? parseInt(body.status) : 1,
                body.order !== undefined ? parseInt(body.order) : 0
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Category created successfully',
            category: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateCategory(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.categories WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Category not found' });
        }

        const prev = existing[0];
        let imageFilename = prev.image;

        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'categories');
        } else if (body.image !== undefined) {
            imageFilename = body.image || null;
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        // Check if updating slug creates conflict
        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.categories WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        let parentCategory = prev.parent_category;
        if (body.parent_category !== undefined) {
            parentCategory = body.parent_category && body.parent_category !== '0' && body.parent_category !== ''
                ? String(body.parent_category)
                : null;
        }

        const { rows: updated } = await query(
            `UPDATE public.categories SET
                title = $1,
                slug = $2,
                parent_category = $3,
                image = $4,
                description = $5,
                navigation_status = $6,
                home_status = $7,
                seo_title = $8,
                seo_keyword = $9,
                seo_description = $10,
                status = $11,
                "order" = $12,
                updated_at = NOW()
            WHERE id = $13
            RETURNING *`,
            [
                title,
                slug,
                parentCategory,
                imageFilename,
                body.description !== undefined ? body.description : prev.description,
                body.navigation_status !== undefined ? parseInt(body.navigation_status) : prev.navigation_status,
                body.home_status !== undefined ? parseInt(body.home_status) : prev.home_status,
                body.seo_title !== undefined ? body.seo_title : prev.seo_title,
                body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
                body.seo_description !== undefined ? body.seo_description : prev.seo_description,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                body.order !== undefined ? parseInt(body.order) : prev.order,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Category updated successfully',
            category: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleCategoryStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: categories } = await query(
            `SELECT id, status FROM public.categories WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (categories.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Category not found' });
        }

        const newStatus = categories[0].status === 1 ? 0 : 1;
        await query(
            `UPDATE public.categories SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, id]
        );

        return res.json({
            result: 'success',
            message: `Category ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteCategory(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image FROM public.categories WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Category not found' });
        }

        const category = existing[0];
        if (category.image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`categories/${category.image}`]);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on category delete:', storageErr.message);
            }
        }

        // Reassign any subcategories that point to this parent
        await query(
            `UPDATE public.categories SET parent_category = NULL WHERE parent_category = $1`,
            [String(id)]
        );

        await query(`DELETE FROM public.categories WHERE id = $1`, [id]);

        return res.json({
            result: 'success',
            message: 'Category deleted successfully'
        });
    } catch (err) {
        next(err);
    }
}
