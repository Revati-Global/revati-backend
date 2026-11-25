import { query } from '../config/db.js';
import { getImageUrl, getPdfUrl } from '../helpers/serializers.js';
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

function parseJsonSafe(val, fallback = null) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    try {
        return JSON.parse(val);
    } catch {
        return fallback;
    }
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
            params.push(parseInt(category_id, 10));
            sql += ` AND p.category_id = $${params.length}`;
        }

        if (status && status !== 'all') {
            params.push(parseInt(status, 10));
            sql += ` AND p.status = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE(p."order", 9999) ASC, p.id DESC`;

        const { rows: products } = await query(sql, params);

        const formatted = products.map(p => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            category_id: p.category_id,
            category_title: p.category_title || null,
            category_slug: p.category_slug || null,
            description: p.description,
            feature_and_benefit: p.feature_and_benefit,
            benefit_description: p.benefit_description,
            specifications: parseJsonSafe(p.specifications, {}),
            additionals: parseJsonSafe(p.additionals, []),
            capacity: p.capacity,
            power: p.power,
            datasheet: p.datasheet ? getPdfUrl(p.datasheet, 'downloads') : null,
            raw_datasheet: p.datasheet,
            catalogue: p.catalogue ? getPdfUrl(p.catalogue, 'downloads') : null,
            raw_catalogue: p.catalogue,
            image: p.image ? getImageUrl(p.image, 'products') : null,
            raw_image: p.image,
            benefit_image: p.benefit_image ? getImageUrl(p.benefit_image, 'products') : null,
            raw_benefit_image: p.benefit_image,
            status: p.status ?? 1,
            order: p.order ?? 0,
            seo_title: p.seo_title,
            seo_keyword: p.seo_keyword || p.seo_keywords,
            seo_description: p.seo_description,
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
            `SELECT p.*, c.title as category_title, c.slug as category_slug 
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
                datasheet_url: p.datasheet ? getPdfUrl(p.datasheet, 'downloads') : null,
                catalogue_url: p.catalogue ? getPdfUrl(p.catalogue, 'downloads') : null,
                specifications: parseJsonSafe(p.specifications, {}),
                additionals: parseJsonSafe(p.additionals, [])
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
            return res.status(400).json({ result: 'error', message: 'Product title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);

        const { rows: existingSlug } = await query(
            `SELECT id FROM public.products WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        const imagePath = cleanStoragePath(body.image);
        const benefitImagePath = cleanStoragePath(body.benefit_image);
        const datasheetPath = cleanStoragePath(body.datasheet);
        const cataloguePath = cleanStoragePath(body.catalogue);

        const categoryId = body.category_id && body.category_id !== '0' && body.category_id !== '' 
            ? parseInt(body.category_id, 10) 
            : null;

        const specs = parseJsonSafe(body.specifications, null);
        const additionals = parseJsonSafe(body.additionals, null);

        const insertSql = `
            INSERT INTO public.products (
                slug, user_id, category_id, title, description,
                feature_and_benefit, benefit_description, benefit_image,
                specifications, additionals, capacity, power,
                datasheet, catalogue, image, status, "order",
                seo_title, seo_description, seo_keyword, seo_keywords,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14, $15, $16, $17,
                $18, $19, $20, $21,
                NOW(), NOW()
            ) RETURNING *;
        `;

        const { rows } = await query(insertSql, [
            slug,
            req.user?.id ? parseInt(req.user.id, 10) : 1,
            categoryId,
            body.title.trim(),
            body.description || '',
            body.feature_and_benefit || null,
            body.benefit_description || null,
            benefitImagePath,
            specs ? JSON.stringify(specs) : null,
            additionals ? JSON.stringify(additionals) : null,
            body.capacity || null,
            body.power || null,
            datasheetPath,
            cataloguePath,
            imagePath,
            body.status !== undefined ? parseInt(body.status, 10) : 1,
            body.order !== undefined ? parseInt(body.order, 10) : 0,
            body.seo_title || null,
            body.seo_description || null,
            body.seo_keyword || null,
            body.seo_keyword || null
        ]);

        return res.status(201).json({
            result: 'success',
            message: 'Product created successfully',
            product: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateProduct(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(`SELECT * FROM public.products WHERE id = $1 LIMIT 1`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Product not found' });
        }
        const prev = existing[0];

        let imagePath = prev.image;
        if (body.image !== undefined) {
            imagePath = cleanStoragePath(body.image);
            if (prev.image && imagePath !== prev.image) {
                removeStorageFiles(prev.image).catch(() => {});
            }
        }

        let benefitImagePath = prev.benefit_image;
        if (body.benefit_image !== undefined) {
            benefitImagePath = cleanStoragePath(body.benefit_image);
            if (prev.benefit_image && benefitImagePath !== prev.benefit_image) {
                removeStorageFiles(prev.benefit_image).catch(() => {});
            }
        }

        let datasheetPath = prev.datasheet;
        if (body.datasheet !== undefined) {
            datasheetPath = cleanStoragePath(body.datasheet);
            if (prev.datasheet && datasheetPath !== prev.datasheet) {
                removeStorageFiles(prev.datasheet).catch(() => {});
            }
        }

        let cataloguePath = prev.catalogue;
        if (body.catalogue !== undefined) {
            cataloguePath = cleanStoragePath(body.catalogue);
            if (prev.catalogue && cataloguePath !== prev.catalogue) {
                removeStorageFiles(prev.catalogue).catch(() => {});
            }
        }

        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;
        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(`SELECT id FROM public.products WHERE slug = $1 AND id != $2 LIMIT 1`, [slug, id]);
            if (slugCheck.length > 0) slug = `${slug}-${Date.now()}`;
        }

        const categoryId = body.category_id !== undefined
            ? (body.category_id && body.category_id !== '0' && body.category_id !== '' ? parseInt(body.category_id, 10) : null)
            : prev.category_id;

        const specs = body.specifications !== undefined ? parseJsonSafe(body.specifications, null) : parseJsonSafe(prev.specifications, null);
        const additionals = body.additionals !== undefined ? parseJsonSafe(body.additionals, null) : parseJsonSafe(prev.additionals, null);

        const updateSql = `
            UPDATE public.products SET
                title = $1,
                slug = $2,
                category_id = $3,
                description = $4,
                feature_and_benefit = $5,
                benefit_description = $6,
                benefit_image = $7,
                specifications = $8,
                additionals = $9,
                capacity = $10,
                power = $11,
                datasheet = $12,
                catalogue = $13,
                image = $14,
                status = $15,
                "order" = $16,
                seo_title = $17,
                seo_description = $18,
                seo_keyword = $19,
                seo_keywords = $20,
                updated_at = NOW()
            WHERE id = $21
            RETURNING *;
        `;

        const { rows } = await query(updateSql, [
            body.title !== undefined ? body.title.trim() : prev.title,
            slug,
            categoryId,
            body.description !== undefined ? body.description : prev.description,
            body.feature_and_benefit !== undefined ? body.feature_and_benefit : prev.feature_and_benefit,
            body.benefit_description !== undefined ? body.benefit_description : prev.benefit_description,
            benefitImagePath,
            specs ? JSON.stringify(specs) : null,
            additionals ? JSON.stringify(additionals) : null,
            body.capacity !== undefined ? body.capacity : prev.capacity,
            body.power !== undefined ? body.power : prev.power,
            datasheetPath,
            cataloguePath,
            imagePath,
            body.status !== undefined ? parseInt(body.status, 10) : prev.status,
            body.order !== undefined ? parseInt(body.order, 10) : prev.order,
            body.seo_title !== undefined ? body.seo_title : prev.seo_title,
            body.seo_description !== undefined ? body.seo_description : prev.seo_description,
            body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
            body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keywords,
            id
        ]);

        return res.json({
            result: 'success',
            message: 'Product updated successfully',
            product: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleProductStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT id, status FROM public.products WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Product not found' });

        const newStatus = rows[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.products SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({ result: 'success', status: newStatus });
    } catch (err) {
        next(err);
    }
}

export async function deleteProduct(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT image, benefit_image, datasheet, catalogue FROM public.products WHERE id = $1 LIMIT 1`, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Product not found' });
        }

        const p = rows[0];
        // Clean up all related files from Supabase Storage
        const filesToRemove = [p.image, p.benefit_image, p.datasheet, p.catalogue].filter(Boolean);
        if (filesToRemove.length > 0) {
            await removeStorageFiles(filesToRemove);
        }

        await query(`DELETE FROM public.products WHERE id = $1`, [id]);

        return res.json({ result: 'success', message: 'Product and associated storage assets deleted successfully' });
    } catch (err) {
        next(err);
    }
}
