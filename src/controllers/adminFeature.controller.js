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

export async function listFeatures(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.features WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length} OR description ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND status = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE("order", 9999) ASC, id ASC`;

        const { rows: features } = await query(sql, params);

        const formatted = features.map(f => ({
            id: f.id,
            slug: f.slug,
            title: f.title,
            image: f.image ? getImageUrl(f.image, 'features') : null,
            raw_image: f.image,
            description: f.description,
            link: f.link,
            order: f.order ?? 0,
            status: f.status ?? 1,
            created_at: f.created_at,
            updated_at: f.updated_at
        }));

        return res.json({ result: 'success', features: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getFeature(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: features } = await query(
            `SELECT * FROM public.features WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (features.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Feature not found' });
        }

        const f = features[0];
        return res.json({
            result: 'success',
            feature: {
                ...f,
                image_url: f.image ? getImageUrl(f.image, 'features') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createFeature(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Feature title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.features WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        let imageFilename = body.image || null;
        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'features');
        }

        const { rows: inserted } = await query(
            `INSERT INTO public.features (
                slug, user_id, title, image, description,
                link, status, "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                imageFilename,
                body.description || null,
                body.link || null,
                body.status !== undefined ? parseInt(body.status) : 1,
                body.order !== undefined ? parseInt(body.order) : 0
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Feature created successfully',
            feature: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateFeature(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.features WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Feature not found' });
        }

        const prev = existing[0];
        let imageFilename = prev.image;

        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'features');
        } else if (body.image !== undefined) {
            imageFilename = body.image || null;
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.features WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const { rows: updated } = await query(
            `UPDATE public.features SET
                title = $1,
                slug = $2,
                image = $3,
                description = $4,
                link = $5,
                status = $6,
                "order" = $7,
                updated_at = NOW()
            WHERE id = $8
            RETURNING *`,
            [
                title,
                slug,
                imageFilename,
                body.description !== undefined ? body.description : prev.description,
                body.link !== undefined ? body.link : prev.link,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                body.order !== undefined ? parseInt(body.order) : prev.order,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Feature updated successfully',
            feature: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleFeatureStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: features } = await query(
            `SELECT id, status FROM public.features WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (features.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Feature not found' });
        }

        const newStatus = features[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.features SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({
            result: 'success',
            message: `Feature ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteFeature(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image FROM public.features WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Feature not found' });
        }

        const feat = existing[0];
        if (feat.image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`features/${feat.image}`]);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on feature delete:', storageErr.message);
            }
        }

        await query(`DELETE FROM public.features WHERE id = $1`, [id]);

        return res.json({ result: 'success', message: 'Feature deleted successfully' });
    } catch (err) {
        next(err);
    }
}
