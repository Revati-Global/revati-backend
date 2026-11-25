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

export async function listApplications(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.applications WHERE 1=1`;
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

        const { rows: applications } = await query(sql, params);

        const formatted = applications.map(a => ({
            id: a.id,
            slug: a.slug,
            title: a.title,
            image: a.image ? getImageUrl(a.image, 'applications') : null,
            raw_image: a.image,
            description: a.description,
            order: a.order ?? 0,
            status: a.status ?? 1,
            seo_title: a.seo_title,
            seo_keyword: a.seo_keyword,
            seo_description: a.seo_description,
            created_at: a.created_at,
            updated_at: a.updated_at
        }));

        return res.json({ result: 'success', applications: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getApplication(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT * FROM public.applications WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Application not found' });

        const a = rows[0];
        return res.json({
            result: 'success',
            application: {
                ...a,
                image_url: a.image ? getImageUrl(a.image, 'applications') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createApplication(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Application title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const existing = await query(`SELECT id FROM public.applications WHERE slug = $1 LIMIT 1`, [slug]);
        if (existing.rows.length > 0) slug = `${slug}-${Date.now()}`;

        const imagePath = cleanStoragePath(body.image);

        const insertSql = `
            INSERT INTO public.applications (
                slug, user_id, title, image, description,
                status, "order",
                seo_title, seo_keyword, seo_description,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7,
                $8, $9, $10,
                NOW(), NOW()
            ) RETURNING *;
        `;

        const { rows } = await query(insertSql, [
            slug,
            req.user?.id ? parseInt(req.user.id, 10) : 1,
            body.title.trim(),
            imagePath,
            body.description || null,
            body.status !== undefined ? parseInt(body.status, 10) : 1,
            body.order !== undefined ? parseInt(body.order, 10) : 0,
            body.seo_title || null,
            body.seo_keyword || null,
            body.seo_description || null
        ]);

        return res.status(201).json({ result: 'success', application: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function updateApplication(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(`SELECT * FROM public.applications WHERE id = $1 LIMIT 1`, [id]);
        if (existing.length === 0) return res.status(404).json({ result: 'error', message: 'Application not found' });
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
            const slugCheck = await query(`SELECT id FROM public.applications WHERE slug = $1 AND id != $2 LIMIT 1`, [slug, id]);
            if (slugCheck.rows.length > 0) slug = `${slug}-${Date.now()}`;
        }

        const updateSql = `
            UPDATE public.applications SET
                title = $1,
                slug = $2,
                image = $3,
                description = $4,
                status = $5,
                "order" = $6,
                seo_title = $7,
                seo_keyword = $8,
                seo_description = $9,
                updated_at = NOW()
            WHERE id = $10
            RETURNING *;
        `;

        const { rows } = await query(updateSql, [
            body.title !== undefined ? body.title.trim() : prev.title,
            slug,
            imagePath,
            body.description !== undefined ? body.description : prev.description,
            body.status !== undefined ? parseInt(body.status, 10) : prev.status,
            body.order !== undefined ? parseInt(body.order, 10) : prev.order,
            body.seo_title !== undefined ? body.seo_title : prev.seo_title,
            body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
            body.seo_description !== undefined ? body.seo_description : prev.seo_description,
            id
        ]);

        return res.json({ result: 'success', application: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function toggleApplicationStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT id, status FROM public.applications WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Application not found' });

        const newStatus = rows[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.applications SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);
        return res.json({ result: 'success', status: newStatus });
    } catch (err) {
        next(err);
    }
}

export async function deleteApplication(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT image FROM public.applications WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Application not found' });

        if (rows[0].image) {
            await removeStorageFiles(rows[0].image);
        }

        await query(`DELETE FROM public.applications WHERE id = $1`, [id]);
        return res.json({ result: 'success', message: 'Application deleted successfully' });
    } catch (err) {
        next(err);
    }
}
