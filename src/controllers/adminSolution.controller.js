import { uploadAndOptimizeMedia } from '../helpers/mediaOptimizer.js';
import { query } from '../config/db.js';
import { supabase, BUCKET_NAME } from '../config/supabase.js';
import { getImageUrl } from '../helpers/serializers.js';

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

export async function listSolutions(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.solutions WHERE 1=1`;
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

        const { rows: solutions } = await query(sql, params);

        const formatted = solutions.map(s => ({
            id: s.id,
            slug: s.slug,
            title: s.title,
            image: s.image ? getImageUrl(s.image, 'solutions') : null,
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

        return res.json({ result: 'success', solutions: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getSolution(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: solutions } = await query(
            `SELECT * FROM public.solutions WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (solutions.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Solution not found' });
        }

        const s = solutions[0];
        return res.json({
            result: 'success',
            solution: {
                ...s,
                image_url: s.image ? getImageUrl(s.image, 'solutions') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createSolution(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Solution title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.solutions WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now().toString().slice(-4)}`;
        }

        let imageFilename = null;
        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'solutions');
        }

        let featuresJson = null;
        if (body.features) {
            featuresJson = typeof body.features === 'string' ? JSON.parse(body.features) : body.features;
        }

        const insertSql = `
            INSERT INTO public.solutions (
                slug, title, image, summary, description, features,
                status, "order", seo_title, seo_keyword, seo_description,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11,
                NOW(), NOW()
            ) RETURNING *;
        `;

        const values = [
            slug,
            body.title.trim(),
            imageFilename,
            body.summary || null,
            body.description || null,
            featuresJson ? JSON.stringify(featuresJson) : null,
            body.status !== undefined ? parseInt(body.status) : 1,
            body.order !== undefined && body.order !== '' ? parseInt(body.order) : 0,
            body.seo_title || null,
            body.seo_keyword || null,
            body.seo_description || null
        ];

        const { rows } = await query(insertSql, values);
        return res.status(201).json({
            result: 'success',
            message: 'Solution created successfully',
            solution: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateSolution(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.solutions WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Solution not found' });
        }
        const current = existing[0];

        let imageFilename = current.image;
        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'solutions');
            if (current.image) {
                try {
                    await supabase.storage.from(BUCKET_NAME).remove([`solutions/${current.image}`]);
                } catch (e) {
                    // ignore
                }
            }
        }

        let slug = current.slug;
        if (body.slug && body.slug.trim() !== '') {
            const desiredSlug = slugify(body.slug);
            if (desiredSlug !== current.slug) {
                const { rows: check } = await query(
                    `SELECT id FROM public.solutions WHERE slug = $1 AND id != $2 LIMIT 1`,
                    [desiredSlug, id]
                );
                slug = check.length > 0 ? `${desiredSlug}-${Date.now().toString().slice(-4)}` : desiredSlug;
            }
        }

        let featuresJson = current.features;
        if (body.features !== undefined) {
            featuresJson = typeof body.features === 'string' ? JSON.parse(body.features) : body.features;
        }

        const updateSql = `
            UPDATE public.solutions SET
                title = COALESCE($1, title),
                slug = $2,
                image = $3,
                summary = $4,
                description = $5,
                features = $6,
                status = COALESCE($7, status),
                "order" = COALESCE($8, "order"),
                seo_title = $9,
                seo_keyword = $10,
                seo_description = $11,
                updated_at = NOW()
            WHERE id = $12
            RETURNING *;
        `;

        const values = [
            body.title ? body.title.trim() : null,
            slug,
            imageFilename,
            body.summary !== undefined ? body.summary : current.summary,
            body.description !== undefined ? body.description : current.description,
            featuresJson ? JSON.stringify(featuresJson) : null,
            body.status !== undefined ? parseInt(body.status) : null,
            body.order !== undefined && body.order !== '' ? parseInt(body.order) : null,
            body.seo_title !== undefined ? body.seo_title : current.seo_title,
            body.seo_keyword !== undefined ? body.seo_keyword : current.seo_keyword,
            body.seo_description !== undefined ? body.seo_description : current.seo_description,
            id
        ];

        const { rows } = await query(updateSql, values);
        return res.json({
            result: 'success',
            message: 'Solution updated successfully',
            solution: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteSolution(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(
            `DELETE FROM public.solutions WHERE id = $1 RETURNING image`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Solution not found' });
        }

        if (rows[0].image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`solutions/${rows[0].image}`]);
            } catch (e) {
                // ignore
            }
        }

        return res.json({ result: 'success', message: 'Solution deleted successfully' });
    } catch (err) {
        next(err);
    }
}

export async function toggleSolutionStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(
            `UPDATE public.solutions SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = NOW() WHERE id = $1 RETURNING id, status`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Solution not found' });
        }

        return res.json({
            result: 'success',
            message: `Solution ${rows[0].status === 1 ? 'activated' : 'deactivated'}`,
            status: rows[0].status
        });
    } catch (err) {
        next(err);
    }
}

