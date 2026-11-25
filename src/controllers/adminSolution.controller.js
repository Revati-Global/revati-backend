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

export async function listSolutions(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.solutions WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status, 10));
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
            features: s.features ? (typeof s.features === 'string' ? JSON.parse(s.features) : s.features) : [],
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
        const { rows } = await query(`SELECT * FROM public.solutions WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Solution not found' });

        const s = rows[0];
        return res.json({
            result: 'success',
            solution: {
                ...s,
                image_url: s.image ? getImageUrl(s.image, 'solutions') : null,
                features: s.features ? (typeof s.features === 'string' ? JSON.parse(s.features) : s.features) : []
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
        const existing = await query(`SELECT id FROM public.solutions WHERE slug = $1 LIMIT 1`, [slug]);
        if (existing.rows.length > 0) slug = `${slug}-${Date.now()}`;

        const imagePath = cleanStoragePath(body.image);
        let features = body.features;
        if (typeof features === 'string') {
            try { features = JSON.parse(features); } catch { features = []; }
        }

        const insertSql = `
            INSERT INTO public.solutions (
                slug, user_id, title, image, summary, description,
                features, status, "order",
                seo_title, seo_keyword, seo_description,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9,
                $10, $11, $12,
                NOW(), NOW()
            ) RETURNING *;
        `;

        const { rows } = await query(insertSql, [
            slug,
            req.user?.id ? parseInt(req.user.id, 10) : 1,
            body.title.trim(),
            imagePath,
            body.summary || null,
            body.description || null,
            features ? JSON.stringify(features) : null,
            body.status !== undefined ? parseInt(body.status, 10) : 1,
            body.order !== undefined ? parseInt(body.order, 10) : 0,
            body.seo_title || null,
            body.seo_keyword || null,
            body.seo_description || null
        ]);

        return res.status(201).json({ result: 'success', solution: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function updateSolution(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(`SELECT * FROM public.solutions WHERE id = $1 LIMIT 1`, [id]);
        if (existing.length === 0) return res.status(404).json({ result: 'error', message: 'Solution not found' });
        const prev = existing[0];

        let imagePath = prev.image;
        if (body.image !== undefined) {
            imagePath = cleanStoragePath(body.image);
            if (prev.image && imagePath !== prev.image) {
                removeStorageFiles(prev.image).catch(() => {});
            }
        }

        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;
        if (slug !== prev.slug) {
            const slugCheck = await query(`SELECT id FROM public.solutions WHERE slug = $1 AND id != $2 LIMIT 1`, [slug, id]);
            if (slugCheck.rows.length > 0) slug = `${slug}-${Date.now()}`;
        }

        let features = body.features !== undefined ? body.features : prev.features;
        if (typeof features === 'string') {
            try { features = JSON.parse(features); } catch { features = []; }
        }

        const updateSql = `
            UPDATE public.solutions SET
                title = $1,
                slug = $2,
                image = $3,
                summary = $4,
                description = $5,
                features = $6,
                status = $7,
                "order" = $8,
                seo_title = $9,
                seo_keyword = $10,
                seo_description = $11,
                updated_at = NOW()
            WHERE id = $12
            RETURNING *;
        `;

        const { rows } = await query(updateSql, [
            body.title !== undefined ? body.title.trim() : prev.title,
            slug,
            imagePath,
            body.summary !== undefined ? body.summary : prev.summary,
            body.description !== undefined ? body.description : prev.description,
            features ? JSON.stringify(features) : null,
            body.status !== undefined ? parseInt(body.status, 10) : prev.status,
            body.order !== undefined ? parseInt(body.order, 10) : prev.order,
            body.seo_title !== undefined ? body.seo_title : prev.seo_title,
            body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
            body.seo_description !== undefined ? body.seo_description : prev.seo_description,
            id
        ]);

        return res.json({ result: 'success', solution: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function toggleSolutionStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT id, status FROM public.solutions WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Solution not found' });

        const newStatus = rows[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.solutions SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);
        return res.json({ result: 'success', status: newStatus });
    } catch (err) {
        next(err);
    }
}

export async function deleteSolution(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT image FROM public.solutions WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Solution not found' });

        if (rows[0].image) {
            await removeStorageFiles(rows[0].image);
        }

        await query(`DELETE FROM public.solutions WHERE id = $1`, [id]);
        return res.json({ result: 'success', message: 'Solution deleted successfully' });
    } catch (err) {
        next(err);
    }
}
