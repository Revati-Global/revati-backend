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

export async function listServices(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.services WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length} OR summary ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND status = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE("order", 9999) ASC, id ASC`;

        const { rows: services } = await query(sql, params);

        const formatted = services.map(s => ({
            id: s.id,
            slug: s.slug,
            title: s.title,
            image: s.image ? getImageUrl(s.image, 'services') : null,
            raw_image: s.image,
            summary: s.summary,
            description: s.description,
            features: s.features,
            order: s.order ?? 0,
            status: s.status ?? 1,
            seo_title: s.seo_title,
            seo_keyword: s.seo_keyword,
            seo_description: s.seo_description,
            created_at: s.created_at,
            updated_at: s.updated_at
        }));

        return res.json({ result: 'success', services: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getService(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: services } = await query(
            `SELECT * FROM public.services WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (services.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Service not found' });
        }

        const s = services[0];
        return res.json({
            result: 'success',
            service: {
                ...s,
                image_url: s.image ? getImageUrl(s.image, 'services') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createService(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Service title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.services WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        let imageFilename = body.image || null;
        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'services');
        }

        const { rows: inserted } = await query(
            `INSERT INTO public.services (
                slug, user_id, title, image, summary,
                description, features, seo_title, seo_keyword,
                seo_description, status, "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12, NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                imageFilename,
                body.summary || null,
                body.description || null,
                body.features || null,
                body.seo_title || null,
                body.seo_keyword || null,
                body.seo_description || null,
                body.status !== undefined ? parseInt(body.status) : 1,
                body.order !== undefined ? parseInt(body.order) : 0
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Service created successfully',
            service: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateService(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.services WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Service not found' });
        }

        const prev = existing[0];
        let imageFilename = prev.image;

        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'services');
        } else if (body.image !== undefined) {
            imageFilename = body.image || null;
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.services WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const { rows: updated } = await query(
            `UPDATE public.services SET
                title = $1,
                slug = $2,
                image = $3,
                summary = $4,
                description = $5,
                features = $6,
                seo_title = $7,
                seo_keyword = $8,
                seo_description = $9,
                status = $10,
                "order" = $11,
                updated_at = NOW()
            WHERE id = $12
            RETURNING *`,
            [
                title,
                slug,
                imageFilename,
                body.summary !== undefined ? body.summary : prev.summary,
                body.description !== undefined ? body.description : prev.description,
                body.features !== undefined ? body.features : prev.features,
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
            message: 'Service updated successfully',
            service: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleServiceStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: services } = await query(
            `SELECT id, status FROM public.services WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (services.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Service not found' });
        }

        const newStatus = services[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.services SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({
            result: 'success',
            message: `Service ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteService(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image FROM public.services WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Service not found' });
        }

        const service = existing[0];
        if (service.image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`services/${service.image}`]);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on service delete:', storageErr.message);
            }
        }

        await query(`DELETE FROM public.services WHERE id = $1`, [id]);

        return res.json({ result: 'success', message: 'Service deleted successfully' });
    } catch (err) {
        next(err);
    }
}
