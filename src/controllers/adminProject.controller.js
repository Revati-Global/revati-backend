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

export async function listProjects(req, res, next) {
    try {
        const { search, status, project_type } = req.query;
        let sql = `SELECT * FROM public.projects WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length} OR location ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status, 10));
            sql += ` AND status = $${params.length}`;
        }

        if (project_type && project_type !== 'all') {
            params.push(project_type);
            sql += ` AND project_type = $${params.length}`;
        }

        sql += ` ORDER BY COALESCE("order", 9999) ASC, id DESC`;

        const { rows: projects } = await query(sql, params);

        const formatted = projects.map(p => ({
            id: p.id,
            slug: p.slug,
            title: p.title,
            location: p.location,
            project_type: p.project_type,
            image: p.image ? getImageUrl(p.image, 'projects') : null,
            raw_image: p.image,
            images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : [],
            description: p.description,
            order: p.order ?? 0,
            status: p.status ?? 1,
            seo_title: p.seo_title,
            seo_keyword: p.seo_keyword,
            seo_description: p.seo_description,
            created_at: p.created_at,
            updated_at: p.updated_at
        }));

        return res.json({ result: 'success', projects: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getProject(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT * FROM public.projects WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Project not found' });

        const p = rows[0];
        return res.json({
            result: 'success',
            project: {
                ...p,
                image_url: p.image ? getImageUrl(p.image, 'projects') : null,
                images: p.images ? (typeof p.images === 'string' ? JSON.parse(p.images) : p.images) : []
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createProject(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Project title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const existing = await query(`SELECT id FROM public.projects WHERE slug = $1 LIMIT 1`, [slug]);
        if (existing.rows.length > 0) slug = `${slug}-${Date.now()}`;

        const imagePath = cleanStoragePath(body.image);
        let galleryImages = body.images;
        if (typeof galleryImages === 'string') {
            try { galleryImages = JSON.parse(galleryImages); } catch { galleryImages = []; }
        }

        const insertSql = `
            INSERT INTO public.projects (
                slug, user_id, title, location, project_type,
                image, images, description, status, "order",
                seo_title, seo_keyword, seo_description,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, $10,
                $11, $12, $13,
                NOW(), NOW()
            ) RETURNING *;
        `;

        const { rows } = await query(insertSql, [
            slug,
            req.user?.id ? parseInt(req.user.id, 10) : 1,
            body.title.trim(),
            body.location || null,
            body.project_type || null,
            imagePath,
            galleryImages ? JSON.stringify(galleryImages) : null,
            body.description || null,
            body.status !== undefined ? parseInt(body.status, 10) : 1,
            body.order !== undefined ? parseInt(body.order, 10) : 0,
            body.seo_title || null,
            body.seo_keyword || null,
            body.seo_description || null
        ]);

        return res.status(201).json({ result: 'success', project: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function updateProject(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(`SELECT * FROM public.projects WHERE id = $1 LIMIT 1`, [id]);
        if (existing.length === 0) return res.status(404).json({ result: 'error', message: 'Project not found' });
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
            const slugCheck = await query(`SELECT id FROM public.projects WHERE slug = $1 AND id != $2 LIMIT 1`, [slug, id]);
            if (slugCheck.rows.length > 0) slug = `${slug}-${Date.now()}`;
        }

        let galleryImages = body.images !== undefined ? body.images : prev.images;
        if (typeof galleryImages === 'string') {
            try { galleryImages = JSON.parse(galleryImages); } catch { galleryImages = []; }
        }

        const updateSql = `
            UPDATE public.projects SET
                title = $1,
                slug = $2,
                location = $3,
                project_type = $4,
                image = $5,
                images = $6,
                description = $7,
                status = $8,
                "order" = $9,
                seo_title = $10,
                seo_keyword = $11,
                seo_description = $12,
                updated_at = NOW()
            WHERE id = $13
            RETURNING *;
        `;

        const { rows } = await query(updateSql, [
            body.title !== undefined ? body.title.trim() : prev.title,
            slug,
            body.location !== undefined ? body.location : prev.location,
            body.project_type !== undefined ? body.project_type : prev.project_type,
            imagePath,
            galleryImages ? JSON.stringify(galleryImages) : null,
            body.description !== undefined ? body.description : prev.description,
            body.status !== undefined ? parseInt(body.status, 10) : prev.status,
            body.order !== undefined ? parseInt(body.order, 10) : prev.order,
            body.seo_title !== undefined ? body.seo_title : prev.seo_title,
            body.seo_keyword !== undefined ? body.seo_keyword : prev.seo_keyword,
            body.seo_description !== undefined ? body.seo_description : prev.seo_description,
            id
        ]);

        return res.json({ result: 'success', project: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function toggleProjectStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT id, status FROM public.projects WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Project not found' });

        const newStatus = rows[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.projects SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);
        return res.json({ result: 'success', status: newStatus });
    } catch (err) {
        next(err);
    }
}

export async function deleteProject(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT image, images FROM public.projects WHERE id = $1 LIMIT 1`, [id]);
        if (rows.length === 0) return res.status(404).json({ result: 'error', message: 'Project not found' });

        const p = rows[0];
        const filesToRemove = [p.image];
        if (p.images) {
            try {
                const parsed = typeof p.images === 'string' ? JSON.parse(p.images) : p.images;
                if (Array.isArray(parsed)) filesToRemove.push(...parsed);
            } catch {}
        }
        await removeStorageFiles(filesToRemove);

        await query(`DELETE FROM public.projects WHERE id = $1`, [id]);
        return res.json({ result: 'success', message: 'Project deleted successfully' });
    } catch (err) {
        next(err);
    }
}
