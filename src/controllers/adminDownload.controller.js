import { uploadAndOptimizeMedia } from '../helpers/mediaOptimizer.js';
import { query } from '../config/db.js';
import { supabase, BUCKET_NAME } from '../config/supabase.js';
import { getImageUrl, getPdfUrl } from '../helpers/serializers.js';

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

export async function listDownloads(req, res, next) {
    try {
        const { search, status, type, category } = req.query;
        let sql = `SELECT * FROM public.downloads WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND status = $${params.length}`;
        }

        if (type && type !== 'all') {
            params.push(type);
            sql += ` AND type = $${params.length}`;
        }

        if (category && category !== 'all') {
            params.push(category);
            sql += ` AND category = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE("order", 9999) ASC, id DESC`;

        const { rows: downloads } = await query(sql, params);

        const formatted = downloads.map(d => ({
            id: d.id,
            slug: d.slug,
            title: d.title,
            file: d.file ? getPdfUrl(d.file, 'downloads') : null,
            raw_file: d.file,
            image: d.image ? getImageUrl(d.image, 'downloads') : null,
            raw_image: d.image,
            type: d.type || 'brochure',
            category: d.category,
            order: d.order ?? 0,
            status: d.status ?? 1,
            created_at: d.created_at,
            updated_at: d.updated_at
        }));

        return res.json({ result: 'success', downloads: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getDownload(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT * FROM public.downloads WHERE id = $1 LIMIT 1`, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Download item not found' });
        }

        const d = rows[0];
        return res.json({
            result: 'success',
            download: {
                ...d,
                file_url: d.file ? getPdfUrl(d.file, 'downloads') : null,
                image_url: d.image ? getImageUrl(d.image, 'downloads') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createDownload(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.downloads WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now().toString().slice(-4)}`;
        }

        let fileFilename = null;
        if (req.file) {
            fileFilename = await uploadAndOptimizeMedia(req.file, 'downloads');
        } else if (body.file) {
            fileFilename = body.file;
        }

        const insertSql = `
            INSERT INTO public.downloads (
                slug, title, file, type, category, image,
                status, "order", created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, NOW(), NOW()
            ) RETURNING *;
        `;

        const values = [
            slug,
            body.title.trim(),
            fileFilename,
            body.type || 'brochure',
            body.category || null,
            body.image || null,
            body.status !== undefined ? parseInt(body.status) : 1,
            body.order !== undefined && body.order !== '' ? parseInt(body.order) : 0
        ];

        const { rows } = await query(insertSql, values);
        return res.status(201).json({
            result: 'success',
            message: 'Download created successfully',
            download: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateDownload(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(`SELECT * FROM public.downloads WHERE id = $1 LIMIT 1`, [id]);
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Download item not found' });
        }
        const current = existing[0];

        let fileFilename = current.file;
        if (req.file) {
            fileFilename = await uploadAndOptimizeMedia(req.file, 'downloads');
            if (current.file) {
                try {
                    await supabase.storage.from(BUCKET_NAME).remove([`downloads/${current.file}`]);
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
                    `SELECT id FROM public.downloads WHERE slug = $1 AND id != $2 LIMIT 1`,
                    [desiredSlug, id]
                );
                slug = check.length > 0 ? `${desiredSlug}-${Date.now().toString().slice(-4)}` : desiredSlug;
            }
        }

        const updateSql = `
            UPDATE public.downloads SET
                title = COALESCE($1, title),
                slug = $2,
                file = $3,
                type = COALESCE($4, type),
                category = COALESCE($5, category),
                image = COALESCE($6, image),
                status = COALESCE($7, status),
                "order" = COALESCE($8, "order"),
                updated_at = NOW()
            WHERE id = $9
            RETURNING *;
        `;

        const values = [
            body.title ? body.title.trim() : null,
            slug,
            fileFilename,
            body.type || null,
            body.category || null,
            body.image || null,
            body.status !== undefined ? parseInt(body.status) : null,
            body.order !== undefined && body.order !== '' ? parseInt(body.order) : null,
            id
        ];

        const { rows } = await query(updateSql, values);
        return res.json({
            result: 'success',
            message: 'Download updated successfully',
            download: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteDownload(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`DELETE FROM public.downloads WHERE id = $1 RETURNING file, image`, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Download item not found' });
        }

        const filesToDelete = [];
        if (rows[0].file) filesToDelete.push(`downloads/${rows[0].file}`);
        if (rows[0].image) filesToDelete.push(`downloads/${rows[0].image}`);

        if (filesToDelete.length > 0) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
            } catch (e) {
                // ignore
            }
        }

        return res.json({ result: 'success', message: 'Download deleted successfully' });
    } catch (err) {
        next(err);
    }
}

export async function toggleDownloadStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(
            `UPDATE public.downloads SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = NOW() WHERE id = $1 RETURNING id, status`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Download item not found' });
        }

        return res.json({
            result: 'success',
            message: `Download ${rows[0].status === 1 ? 'activated' : 'deactivated'}`,
            status: rows[0].status
        });
    } catch (err) {
        next(err);
    }
}

