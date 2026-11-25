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

export async function listDownloads(req, res, next) {
    try {
        const { search, type, status } = req.query;
        let sql = `SELECT * FROM public.downloads WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length} OR category ILIKE $${params.length})`;
        }

        if (type && type !== 'all') {
            params.push(type);
            sql += ` AND type = $${params.length}`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status, 10));
            sql += ` AND status = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE("order", 9999) ASC, id DESC`;

        const { rows: downloads } = await query(sql, params);

        const formatted = downloads.map(d => ({
            id: d.id,
            slug: d.slug,
            title: d.title,
            file: d.file ? getPdfUrl(d.file, 'downloads') : null,
            raw_file: d.file,
            type: d.type || 'brochure',
            category: d.category,
            image: d.image ? getImageUrl(d.image, 'downloads') : null,
            raw_image: d.image,
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
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Download not found' });

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
        const existing = await query(`SELECT id FROM public.downloads WHERE slug = $1 LIMIT 1`, [slug]);
        if (existing.rows.length > 0) slug = `${slug}-${Date.now()}`;

        const filePath = cleanStoragePath(body.file);
        const imagePath = cleanStoragePath(body.image);

        const insertSql = `
            INSERT INTO public.downloads (
                slug, user_id, title, file, type, category,
                image, status, "order",
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9,
                NOW(), NOW()
            ) RETURNING *;
        `;

        const { rows } = await query(insertSql, [
            slug,
            req.user?.id ? parseInt(req.user.id, 10) : 1,
            body.title.trim(),
            filePath,
            body.type || 'brochure',
            body.category || null,
            imagePath,
            body.status !== undefined ? parseInt(body.status, 10) : 1,
            body.order !== undefined ? parseInt(body.order, 10) : 0
        ]);

        return res.status(201).json({ result: 'success', download: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function updateDownload(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(`SELECT * FROM public.downloads WHERE id = $1 LIMIT 1`, [id]);
        if (existing.length === 0) return res.status(404).json({ result: 'error', message: 'Download not found' });
        const prev = existing[0];

        let filePath = prev.file;
        if (body.file !== undefined) {
            filePath = cleanStoragePath(body.file);
            if (prev.file && filePath !== prev.file) {
                removeStorageFiles(prev.file).catch(() => {});
            }
        }

        let imagePath = prev.image;
        if (body.image !== undefined) {
            imagePath = cleanStoragePath(body.image);
            if (prev.image && imagePath !== prev.image) {
                removeStorageFiles(prev.image).catch(() => {});
            }
        }

        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;
        if (slug !== prev.slug) {
            const slugCheck = await query(`SELECT id FROM public.downloads WHERE slug = $1 AND id != $2 LIMIT 1`, [slug, id]);
            if (slugCheck.rows.length > 0) slug = `${slug}-${Date.now()}`;
        }

        const updateSql = `
            UPDATE public.downloads SET
                title = $1,
                slug = $2,
                file = $3,
                type = $4,
                category = $5,
                image = $6,
                status = $7,
                "order" = $8,
                updated_at = NOW()
            WHERE id = $9
            RETURNING *;
        `;

        const { rows } = await query(updateSql, [
            body.title !== undefined ? body.title.trim() : prev.title,
            slug,
            filePath,
            body.type !== undefined ? body.type : prev.type,
            body.category !== undefined ? body.category : prev.category,
            imagePath,
            body.status !== undefined ? parseInt(body.status, 10) : prev.status,
            body.order !== undefined ? parseInt(body.order, 10) : prev.order,
            id
        ]);

        return res.json({ result: 'success', download: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function toggleDownloadStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT id, status FROM public.downloads WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Download not found' });

        const newStatus = rows[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.downloads SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);
        return res.json({ result: 'success', status: newStatus });
    } catch (err) {
        next(err);
    }
}

export async function deleteDownload(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT file, image FROM public.downloads WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Download not found' });

        const filesToRemove = [rows[0].file, rows[0].image].filter(Boolean);
        if (filesToRemove.length > 0) {
            await removeStorageFiles(filesToRemove);
        }

        await query(`DELETE FROM public.downloads WHERE id = $1`, [id]);
        return res.json({ result: 'success', message: 'Download deleted successfully' });
    } catch (err) {
        next(err);
    }
}
