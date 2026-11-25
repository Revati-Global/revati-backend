import { query } from '../config/db.js';
import { getImageUrl } from '../helpers/serializers.js';
import { removeStorageFiles, cleanStoragePath } from '../helpers/storage.js';

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
                   COALESCE(c.parent_id, NULLIF(c.parent_category, '')::bigint) AS parent_id,
                   p.title as parent_title,
                   (SELECT COUNT(*) FROM public.categories sub WHERE sub.parent_id = c.id OR (sub.parent_id IS NULL AND sub.parent_category = CAST(c.id AS VARCHAR))) as subcategory_count,
                   (SELECT COUNT(*) FROM public.products pr WHERE pr.category_id = c.id) as product_count
            FROM public.categories c
            LEFT JOIN public.categories p ON p.id = COALESCE(c.parent_id, NULLIF(c.parent_category, '')::bigint)
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (c.title ILIKE $${params.length} OR c.slug ILIKE $${params.length})`;
        }

        if (parent === 'root') {
            sql += ` AND (c.parent_id IS NULL AND (c.parent_category IS NULL OR c.parent_category = '' OR c.parent_category = '0'))`;
        } else if (parent && parent !== 'all') {
            params.push(parseInt(parent, 10));
            sql += ` AND (c.parent_id = $${params.length} OR c.parent_category = CAST($${params.length} AS VARCHAR))`;
        }

        sql += ` ORDER BY COALESCE(c."order", 9999) ASC, c.id ASC`;

        const { rows: categories } = await query(sql, params);

        const formatted = categories.map(c => {
            const pId = c.parent_id !== null && c.parent_id !== undefined 
                ? Number(c.parent_id) 
                : (c.parent_category ? Number(c.parent_category) : null);

            return {
                id: c.id,
                slug: c.slug,
                title: c.title,
                parent_id: pId,
                parent_category: pId ? String(pId) : null,
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
                subcategory_count: parseInt(c.subcategory_count || 0, 10),
                product_count: parseInt(c.product_count || 0, 10),
                created_at: c.created_at,
                updated_at: c.updated_at
            };
        });

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
        const pId = c.parent_id !== null && c.parent_id !== undefined ? Number(c.parent_id) : (c.parent_category ? Number(c.parent_category) : null);

        return res.json({
            result: 'success',
            category: {
                ...c,
                parent_id: pId,
                parent_category: pId ? String(pId) : null,
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

        const { rows: existingSlug } = await query(
            `SELECT id FROM public.categories WHERE slug = $1 LIMIT 1`,
            [categorySlug]
        );
        if (existingSlug.length > 0) {
            categorySlug = `${categorySlug}-${Date.now()}`;
        }

        const parentId = body.parent_id && body.parent_id !== '0' && body.parent_id !== ''
            ? parseInt(body.parent_id, 10)
            : (body.parent_category && body.parent_category !== '0' && body.parent_category !== '' ? parseInt(body.parent_category, 10) : null);

        // Clean image path if direct upload path or URL passed
        const imagePath = cleanStoragePath(body.image) || null;

        const { rows: inserted } = await query(
            `INSERT INTO public.categories (
                slug, user_id, title, parent_id, parent_category, image, description,
                navigation_status, home_status, seo_title, seo_keyword, seo_description,
                status, "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12,
                $13, $14, NOW(), NOW()
            ) RETURNING *`,
            [
                categorySlug,
                req.user?.id ? parseInt(req.user.id, 10) : 1,
                body.title.trim(),
                parentId,
                parentId ? String(parentId) : null,
                imagePath,
                body.description || null,
                body.navigation_status !== undefined ? parseInt(body.navigation_status, 10) : 1,
                body.home_status !== undefined ? parseInt(body.home_status, 10) : 1,
                body.seo_title || null,
                body.seo_keyword || null,
                body.seo_description || null,
                body.status !== undefined ? parseInt(body.status, 10) : 1,
                body.order !== undefined ? parseInt(body.order, 10) : 0
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

        let imagePath = prev.image;
        if (body.image !== undefined) {
            imagePath = cleanStoragePath(body.image);
            // If image changed and previous image existed, clean up previous file from storage
            if (prev.image && imagePath !== prev.image) {
                removeStorageFiles(prev.image).catch(() => {});
            }
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.categories WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        let parentId = prev.parent_id ?? (prev.parent_category ? parseInt(prev.parent_category, 10) : null);
        if (body.parent_id !== undefined || body.parent_category !== undefined) {
            const rawP = body.parent_id !== undefined ? body.parent_id : body.parent_category;
            parentId = rawP && rawP !== '0' && rawP !== '' ? parseInt(rawP, 10) : null;
        }

        // Prevent setting parent to itself
        if (parentId && String(parentId) === String(id)) {
            return res.status(400).json({
                result: 'error',
                message: 'A category cannot be its own parent.'
            });
        }

        const { rows: updated } = await query(
            `UPDATE public.categories SET
                title = $1,
                slug = $2,
                parent_id = $3,
                parent_category = $4,
                image = $5,
                description = $6,
                navigation_status = $7,
                home_status = $8,
                seo_title = $9,
                seo_keyword = $10,
                seo_description = $11,
                status = $12,
                "order" = $13,
                updated_at = NOW()
            WHERE id = $14
            RETURNING *`,
            [
                title,
                slug,
                parentId,
                parentId ? String(parentId) : null,
                imagePath,
                body.description !== undefined ? body.description : prev.description,
                body.navigation_status !== undefined ? parseInt(body.navigation_status, 10) : prev.navigation_status,
                body.home_status !== undefined ? parseInt(body.home_status, 10) : prev.home_status,
                body.seo_title !== undefined ? body.seo_title : prev.seo_title,
                body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
                body.seo_description !== undefined ? body.seo_description : prev.seo_description,
                body.status !== undefined ? parseInt(body.status, 10) : prev.status,
                body.order !== undefined ? parseInt(body.order, 10) : prev.order,
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

        // Check if category has subcategories
        const subcategories = await query(
            `SELECT id, title FROM public.categories WHERE parent_id = $1 OR parent_category = $2`,
            [id, String(id)]
        );
        if (subcategories.rows.length > 0) {
            return res.status(400).json({
                result: 'error',
                message: `Cannot delete category: It has ${subcategories.rows.length} subcategories attached. Please delete or reassign them first.`
            });
        }

        const { rows: existing } = await query(
            `SELECT image FROM public.categories WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Category not found' });
        }

        const category = existing[0];

        // Clean up image from storage
        if (category.image) {
            await removeStorageFiles(category.image);
        }

        // Reassign any products under this category to NULL
        await query(`UPDATE public.products SET category_id = NULL WHERE category_id = $1`, [id]);

        await query(`DELETE FROM public.categories WHERE id = $1`, [id]);

        return res.json({
            result: 'success',
            message: 'Category deleted successfully. Associated products reassigned to uncategorized.'
        });
    } catch (err) {
        next(err);
    }
}
