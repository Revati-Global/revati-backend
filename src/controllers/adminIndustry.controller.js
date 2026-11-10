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

export async function listIndustries(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.industries WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND status = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE("order", 9999) ASC, id ASC`;

        const { rows: industries } = await query(sql, params);

        const formatted = industries.map(i => ({
            id: i.id,
            slug: i.slug,
            title: i.title,
            image: i.image ? getImageUrl(i.image, 'industries') : null,
            raw_image: i.image,
            description: i.description,
            order: i.order ?? 0,
            status: i.status ?? 1,
            created_at: i.created_at,
            updated_at: i.updated_at
        }));

        return res.json({ result: 'success', industries: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getIndustry(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: industries } = await query(
            `SELECT * FROM public.industries WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (industries.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Industry not found' });
        }

        const ind = industries[0];
        return res.json({
            result: 'success',
            industry: {
                ...ind,
                image_url: ind.image ? getImageUrl(ind.image, 'industries') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createIndustry(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Industry title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.industries WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        let imageFilename = body.image || null;
        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'industries');
        }

        const { rows: inserted } = await query(
            `INSERT INTO public.industries (
                slug, user_id, title, image, description,
                status, "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                imageFilename,
                body.description || null,
                body.status !== undefined ? parseInt(body.status) : 1,
                body.order !== undefined ? parseInt(body.order) : 0
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Industry created successfully',
            industry: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateIndustry(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.industries WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Industry not found' });
        }

        const prev = existing[0];
        let imageFilename = prev.image;

        if (req.file) {
            imageFilename = await uploadFileToSupabase(req.file, 'industries');
        } else if (body.image !== undefined) {
            imageFilename = body.image || null;
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.industries WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const { rows: updated } = await query(
            `UPDATE public.industries SET
                title = $1,
                slug = $2,
                image = $3,
                description = $4,
                status = $5,
                "order" = $6,
                updated_at = NOW()
            WHERE id = $7
            RETURNING *`,
            [
                title,
                slug,
                imageFilename,
                body.description !== undefined ? body.description : prev.description,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                body.order !== undefined ? parseInt(body.order) : prev.order,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Industry updated successfully',
            industry: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleIndustryStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: industries } = await query(
            `SELECT id, status FROM public.industries WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (industries.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Industry not found' });
        }

        const newStatus = industries[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.industries SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({
            result: 'success',
            message: `Industry ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteIndustry(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image FROM public.industries WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Industry not found' });
        }

        const ind = existing[0];
        if (ind.image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`industries/${ind.image}`]);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on industry delete:', storageErr.message);
            }
        }

        await query(`DELETE FROM public.industries WHERE id = $1`, [id]);

        return res.json({ result: 'success', message: 'Industry deleted successfully' });
    } catch (err) {
        next(err);
    }
}
