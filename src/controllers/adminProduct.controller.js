import { uploadAndOptimizeMedia } from '../helpers/mediaOptimizer.js';
import { query } from '../config/db.js';
import { supabase, BUCKET_NAME } from '../config/supabase.js';
import { getImageUrl, getPdfUrl } from '../helpers/serializers.js';
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

function parseAdditionals(additionalsJson) {
    if (!additionalsJson) return [];
    try {
        const parsed = typeof additionalsJson === 'string' ? JSON.parse(additionalsJson) : additionalsJson;
        if (!Array.isArray(parsed)) return [];
        return parsed.map(item => ({
            title: item.title || '',
            description: item.description || '',
            image: item.image ? getImageUrl(item.image, 'products') : '',
            raw_image: item.image || ''
        }));
    } catch (e) {
        return [];
    }
}

async function uploadFileToSupabase(file, folder = 'media') {
    if (!file) return null;
    return await uploadAndOptimizeMedia(file, folder);
}

export async function listProducts(req, res, next) {
    try {
        const { search, category_id, status } = req.query;
        let sql = `
            SELECT p.*, 
                   c.title as category_title,
                   c.slug as category_slug
            FROM public.products p
            LEFT JOIN public.categories c ON c.id = p.category_id
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (p.title ILIKE $${params.length} OR p.slug ILIKE $${params.length})`;
        }

        if (category_id && category_id !== 'all') {
            params.push(parseInt(category_id));
            sql += ` AND p.category_id = $${params.length}`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND p.status = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE(p."order", 9999) ASC, p.id ASC`;

        const { rows: products } = await query(sql, params);

        const formatted = products.map(p => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            category_id: p.category_id,
            category_title: p.category_title || null,
            category_slug: p.category_slug || null,
            image: p.image ? getImageUrl(p.image, 'products') : null,
            raw_image: p.image,
            benefit_image: p.benefit_image ? getImageUrl(p.benefit_image, 'products') : null,
            raw_benefit_image: p.benefit_image,
            catalogue: p.catalogue ? getPdfUrl(p.catalogue) : null,
            raw_catalogue: p.catalogue,
            description: p.description,
            feature_and_benefit: p.feature_and_benefit,
            benefit_description: p.benefit_description,
            additionals: parseAdditionals(p.additionals),
            status: p.status ?? 1,
            order: p.order ?? 0,
            seo_title: p.seo_title,
            seo_description: p.seo_description,
            seo_keywords: p.seo_keywords,
            created_at: p.created_at,
            updated_at: p.updated_at
        }));

        return res.json({
            result: 'success',
            products: formatted
        });
    } catch (err) {
        next(err);
    }
}

export async function getProduct(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: products } = await query(
            `SELECT p.*, 
                    c.title as category_title,
                    c.slug as category_slug
             FROM public.products p
             LEFT JOIN public.categories c ON c.id = p.category_id
             WHERE p.id = $1 LIMIT 1`,
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Product not found' });
        }

        const p = products[0];
        return res.json({
            result: 'success',
            product: {
                ...p,
                image_url: p.image ? getImageUrl(p.image, 'products') : null,
                benefit_image_url: p.benefit_image ? getImageUrl(p.benefit_image, 'products') : null,
                catalogue_url: p.catalogue ? getPdfUrl(p.catalogue) : null,
                additionals: parseAdditionals(p.additionals)
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createProduct(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({
                result: 'error',
                message: 'Product title is required'
            });
        }

        let productSlug = body.slug ? slugify(body.slug) : slugify(body.title);
        
        // Ensure slug uniqueness
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.products WHERE slug = $1 LIMIT 1`,
            [productSlug]
        );
        if (existingSlug.length > 0) {
            productSlug = `${productSlug}-${Date.now()}`;
        }

        let mainImage = body.image || null;
        let benefitImage = body.benefit_image || null;
        let cataloguePdf = body.catalogue || null;

        // Process uploaded files if available
        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                mainImage = await uploadFileToSupabase(req.files.image[0]);
            }
            if (req.files.benefit_image && req.files.benefit_image[0]) {
                benefitImage = await uploadFileToSupabase(req.files.benefit_image[0]);
            }
            if (req.files.catalogue && req.files.catalogue[0]) {
                cataloguePdf = await uploadFileToSupabase(req.files.catalogue[0]);
            }
        }

        // Format additionals JSON
        let additionalsString = '[]';
        if (body.additionals) {
            if (typeof body.additionals === 'string') {
                try {
                    const parsed = JSON.parse(body.additionals);
                    additionalsString = JSON.stringify(parsed);
                } catch (e) {
                    additionalsString = body.additionals;
                }
            } else if (Array.isArray(body.additionals)) {
                additionalsString = JSON.stringify(body.additionals);
            }
        }

        const categoryId = body.category_id ? parseInt(body.category_id) : null;

        const { rows: inserted } = await query(
            `INSERT INTO public.products (
                slug, user_id, category_id, title, description,
                feature_and_benefit, benefit_description, benefit_image,
                additionals, catalogue, image, status,
                seo_title, seo_description, seo_keywords,
                "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14, $15,
                $16, NOW(), NOW()
            ) RETURNING *`,
            [
                productSlug,
                req.user?.id ? parseInt(req.user.id) : 1,
                categoryId,
                body.title.trim(),
                body.description || null,
                body.feature_and_benefit || null,
                body.benefit_description || null,
                benefitImage,
                additionalsString,
                cataloguePdf,
                mainImage,
                body.status !== undefined ? parseInt(body.status) : 1,
                body.seo_title || null,
                body.seo_description || null,
                body.seo_keywords || null,
                body.order !== undefined ? parseInt(body.order) : 0
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Product created successfully',
            product: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateProduct(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.products WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Product not found' });
        }

        const prev = existing[0];
        let mainImage = prev.image;
        let benefitImage = prev.benefit_image;
        let cataloguePdf = prev.catalogue;

        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                mainImage = await uploadFileToSupabase(req.files.image[0]);
            }
            if (req.files.benefit_image && req.files.benefit_image[0]) {
                benefitImage = await uploadFileToSupabase(req.files.benefit_image[0]);
            }
            if (req.files.catalogue && req.files.catalogue[0]) {
                cataloguePdf = await uploadFileToSupabase(req.files.catalogue[0]);
            }
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.products WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        let additionalsString = prev.additionals;
        if (body.additionals !== undefined) {
            if (typeof body.additionals === 'string') {
                additionalsString = body.additionals;
            } else if (Array.isArray(body.additionals)) {
                additionalsString = JSON.stringify(body.additionals);
            }
        }

        const categoryId = body.category_id !== undefined ? (body.category_id ? parseInt(body.category_id) : null) : prev.category_id;

        const { rows: updated } = await query(
            `UPDATE public.products SET
                title = $1,
                slug = $2,
                category_id = $3,
                description = $4,
                feature_and_benefit = $5,
                benefit_description = $6,
                benefit_image = $7,
                additionals = $8,
                catalogue = $9,
                image = $10,
                status = $11,
                seo_title = $12,
                seo_description = $13,
                seo_keywords = $14,
                "order" = $15,
                updated_at = NOW()
            WHERE id = $16
            RETURNING *`,
            [
                title,
                slug,
                categoryId,
                body.description !== undefined ? body.description : prev.description,
                body.feature_and_benefit !== undefined ? body.feature_and_benefit : prev.feature_and_benefit,
                body.benefit_description !== undefined ? body.benefit_description : prev.benefit_description,
                benefitImage,
                additionalsString,
                cataloguePdf,
                mainImage,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                body.seo_title !== undefined ? body.seo_title : prev.seo_title,
                body.seo_description !== undefined ? body.seo_description : prev.seo_description,
                body.seo_keywords !== undefined ? body.seo_keywords : prev.seo_keywords,
                body.order !== undefined ? parseInt(body.order) : prev.order,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Product updated successfully',
            product: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleProductStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: products } = await query(
            `SELECT id, status FROM public.products WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (products.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Product not found' });
        }

        const newStatus = products[0].status === 1 ? 0 : 1;
        await query(
            `UPDATE public.products SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, id]
        );

        return res.json({
            result: 'success',
            message: `Product ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteProduct(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image, benefit_image, catalogue FROM public.products WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Product not found' });
        }

        const product = existing[0];
        const filesToDelete = [product.image, product.benefit_image, product.catalogue]
            .filter(Boolean)
            .map(filename => `products/${filename}`);

        if (filesToDelete.length > 0) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on product delete:', storageErr.message);
            }
        }

        await query(`DELETE FROM public.products WHERE id = $1`, [id]);

        return res.json({
            result: 'success',
            message: 'Product deleted successfully'
        });
    } catch (err) {
        next(err);
    }
}
