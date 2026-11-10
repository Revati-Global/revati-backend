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
            params.push(parseInt(status));
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
        const { rows: applications } = await query(
            `SELECT * FROM public.applications WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Application not found' });
        }

        const a = applications[0];
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
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.applications WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now().toString().slice(-4)}`;
        }

        let imageFilename = null;
        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'applications');
        }

        const insertSql = `
            INSERT INTO public.applications (
                slug, title, image, description,
                status, "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, NOW(), NOW()
            ) RETURNING *;
        `;

        const values = [
            slug,
            body.title.trim(),
            imageFilename,
            body.description || null,
            body.status !== undefined ? parseInt(body.status) : 1,
            body.order !== undefined && body.order !== '' ? parseInt(body.order) : 0
        ];

        const { rows } = await query(insertSql, values);
        return res.status(201).json({
            result: 'success',
            message: 'Application created successfully',
            application: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateApplication(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.applications WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Application not found' });
        }
        const current = existing[0];

        let imageFilename = current.image;
        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'applications');
            if (current.image) {
                try {
                    await supabase.storage.from(BUCKET_NAME).remove([`applications/${current.image}`]);
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
                    `SELECT id FROM public.applications WHERE slug = $1 AND id != $2 LIMIT 1`,
                    [desiredSlug, id]
                );
                slug = check.length > 0 ? `${desiredSlug}-${Date.now().toString().slice(-4)}` : desiredSlug;
            }
        }

        const updateSql = `
            UPDATE public.applications SET
                title = COALESCE($1, title),
                slug = $2,
                image = $3,
                description = $4,
                status = COALESCE($5, status),
                "order" = COALESCE($6, "order"),
                updated_at = NOW()
            WHERE id = $7
            RETURNING *;
        `;

        const values = [
            body.title ? body.title.trim() : null,
            slug,
            imageFilename,
            body.description !== undefined ? body.description : current.description,
            body.status !== undefined ? parseInt(body.status) : null,
            body.order !== undefined && body.order !== '' ? parseInt(body.order) : null,
            id
        ];

        const { rows } = await query(updateSql, values);
        return res.json({
            result: 'success',
            message: 'Application updated successfully',
            application: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteApplication(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(
            `DELETE FROM public.applications WHERE id = $1 RETURNING image`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Application not found' });
        }

        if (rows[0].image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`applications/${rows[0].image}`]);
            } catch (e) {
                // ignore
            }
        }

        return res.json({ result: 'success', message: 'Application deleted successfully' });
    } catch (err) {
        next(err);
    }
}

export async function toggleApplicationStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(
            `UPDATE public.applications SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = NOW() WHERE id = $1 RETURNING id, status`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Application not found' });
        }

        return res.json({
            result: 'success',
            message: `Application ${rows[0].status === 1 ? 'activated' : 'deactivated'}`,
            status: rows[0].status
        });
    } catch (err) {
        next(err);
    }
}
