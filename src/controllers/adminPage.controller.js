import { query } from '../config/db.js';

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

export async function listPages(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.pages WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length} OR summary ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND status = $${params.length}`;
        }

        sql += ` ORDER BY id ASC`;

        const { rows: pages } = await query(sql, params);

        return res.json({ result: 'success', pages });
    } catch (err) {
        next(err);
    }
}

export async function getPage(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: pages } = await query(
            `SELECT * FROM public.pages WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (pages.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Page not found' });
        }

        return res.json({ result: 'success', page: pages[0] });
    } catch (err) {
        next(err);
    }
}

export async function createPage(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Page title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.pages WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        const { rows: inserted } = await query(
            `INSERT INTO public.pages (
                slug, user_id, title, description, image,
                status, summary, seo_title, seo_keyword, seo_description,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                body.description || null,
                body.image || null,
                body.status !== undefined ? parseInt(body.status) : 1,
                body.summary || null,
                body.seo_title || null,
                body.seo_keyword || null,
                body.seo_description || null
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Static page created successfully',
            page: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updatePage(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.pages WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Page not found' });
        }

        const prev = existing[0];
        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.pages WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const { rows: updated } = await query(
            `UPDATE public.pages SET
                title = $1,
                slug = $2,
                description = $3,
                summary = $4,
                seo_title = $5,
                seo_keyword = $6,
                seo_description = $7,
                status = $8,
                updated_at = NOW()
            WHERE id = $9
            RETURNING *`,
            [
                title,
                slug,
                body.description !== undefined ? body.description : prev.description,
                body.summary !== undefined ? body.summary : prev.summary,
                body.seo_title !== undefined ? body.seo_title : prev.seo_title,
                body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
                body.seo_description !== undefined ? body.seo_description : prev.seo_description,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Page updated successfully',
            page: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function togglePageStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: pages } = await query(
            `SELECT id, status FROM public.pages WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (pages.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Page not found' });
        }

        const newStatus = pages[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.pages SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({
            result: 'success',
            message: `Page ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deletePage(req, res, next) {
    try {
        const { id } = req.params;
        const { rowCount } = await query(`DELETE FROM public.pages WHERE id = $1`, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ result: 'error', message: 'Page not found' });
        }

        return res.json({ result: 'success', message: 'Static page deleted successfully' });
    } catch (err) {
        next(err);
    }
}
