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
            params.push(parseInt(status));
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
        const { rows: projects } = await query(
            `SELECT * FROM public.projects WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (projects.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Project not found' });
        }

        const p = projects[0];
        return res.json({
            result: 'success',
            project: {
                ...p,
                image_url: p.image ? getImageUrl(p.image, 'projects') : null
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
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.projects WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now().toString().slice(-4)}`;
        }

        let imageFilename = null;
        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'projects');
        }

        let imagesJson = null;
        if (body.images) {
            imagesJson = typeof body.images === 'string' ? JSON.parse(body.images) : body.images;
        }

        const insertSql = `
            INSERT INTO public.projects (
                slug, title, location, project_type, image, images,
                description, status, "order", seo_title, seo_keyword, seo_description,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12,
                NOW(), NOW()
            ) RETURNING *;
        `;

        const values = [
            slug,
            body.title.trim(),
            body.location || null,
            body.project_type || null,
            imageFilename,
            imagesJson ? JSON.stringify(imagesJson) : null,
            body.description || null,
            body.status !== undefined ? parseInt(body.status) : 1,
            body.order !== undefined && body.order !== '' ? parseInt(body.order) : 0,
            body.seo_title || null,
            body.seo_keyword || null,
            body.seo_description || null
        ];

        const { rows } = await query(insertSql, values);
        return res.status(201).json({
            result: 'success',
            message: 'Project created successfully',
            project: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateProject(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.projects WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Project not found' });
        }
        const current = existing[0];

        let imageFilename = current.image;
        if (req.file) {
            imageFilename = await uploadAndOptimizeMedia(req.file, 'projects');
            if (current.image) {
                try {
                    await supabase.storage.from(BUCKET_NAME).remove([`projects/${current.image}`]);
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
                    `SELECT id FROM public.projects WHERE slug = $1 AND id != $2 LIMIT 1`,
                    [desiredSlug, id]
                );
                slug = check.length > 0 ? `${desiredSlug}-${Date.now().toString().slice(-4)}` : desiredSlug;
            }
        }

        let imagesJson = current.images;
        if (body.images !== undefined) {
            imagesJson = typeof body.images === 'string' ? JSON.parse(body.images) : body.images;
        }

        const updateSql = `
            UPDATE public.projects SET
                title = COALESCE($1, title),
                slug = $2,
                location = $3,
                project_type = $4,
                image = $5,
                images = $6,
                description = $7,
                status = COALESCE($8, status),
                "order" = COALESCE($9, "order"),
                seo_title = $10,
                seo_keyword = $11,
                seo_description = $12,
                updated_at = NOW()
            WHERE id = $13
            RETURNING *;
        `;

        const values = [
            body.title ? body.title.trim() : null,
            slug,
            body.location !== undefined ? body.location : current.location,
            body.project_type !== undefined ? body.project_type : current.project_type,
            imageFilename,
            imagesJson ? JSON.stringify(imagesJson) : null,
            body.description !== undefined ? body.description : current.description,
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
            message: 'Project updated successfully',
            project: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteProject(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(
            `DELETE FROM public.projects WHERE id = $1 RETURNING image`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Project not found' });
        }

        if (rows[0].image) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove([`projects/${rows[0].image}`]);
            } catch (e) {
                // ignore
            }
        }

        return res.json({ result: 'success', message: 'Project deleted successfully' });
    } catch (err) {
        next(err);
    }
}

export async function toggleProjectStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(
            `UPDATE public.projects SET status = CASE WHEN status = 1 THEN 0 ELSE 1 END, updated_at = NOW() WHERE id = $1 RETURNING id, status`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Project not found' });
        }

        return res.json({
            result: 'success',
            message: `Project ${rows[0].status === 1 ? 'activated' : 'deactivated'}`,
            status: rows[0].status
        });
    } catch (err) {
        next(err);
    }
}
