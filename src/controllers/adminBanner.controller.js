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

export async function listBanners(req, res, next) {
    try {
        const { search, status } = req.query;
        let sql = `SELECT * FROM public.banners WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (title ILIKE $${params.length} OR slug ILIKE $${params.length})`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND status = $${params.length}`;
        }

        sql += ` ORDER BY id ASC`;

        const { rows: banners } = await query(sql, params);

        const formatted = banners.map(b => ({
            id: b.id,
            slug: b.slug,
            title: b.title,
            image: b.image ? getImageUrl(b.image, 'banners') : null,
            raw_image: b.image,
            icon: b.icon ? getImageUrl(b.icon, 'banners') : null,
            raw_icon: b.icon,
            status: b.status ?? 1,
            created_at: b.created_at,
            updated_at: b.updated_at
        }));

        return res.json({ result: 'success', banners: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getBanner(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: banners } = await query(
            `SELECT * FROM public.banners WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (banners.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Banner not found' });
        }

        const b = banners[0];
        return res.json({
            result: 'success',
            banner: {
                ...b,
                image_url: b.image ? getImageUrl(b.image, 'banners') : null,
                icon_url: b.icon ? getImageUrl(b.icon, 'banners') : null
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function createBanner(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Banner title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.banners WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        let imageFilename = body.image || null;
        let iconFilename = body.icon || null;

        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                imageFilename = await uploadFileToSupabase(req.files.image[0], 'banners');
            }
            if (req.files.icon && req.files.icon[0]) {
                iconFilename = await uploadFileToSupabase(req.files.icon[0], 'banners');
            }
        }

        const { rows: inserted } = await query(
            `INSERT INTO public.banners (
                slug, user_id, title, image, icon, status, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                imageFilename,
                iconFilename,
                body.status !== undefined ? parseInt(body.status) : 1
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'Banner created successfully',
            banner: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateBanner(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.banners WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Banner not found' });
        }

        const prev = existing[0];
        let imageFilename = prev.image;
        let iconFilename = prev.icon;

        if (req.files) {
            if (req.files.image && req.files.image[0]) {
                imageFilename = await uploadFileToSupabase(req.files.image[0], 'banners');
            }
            if (req.files.icon && req.files.icon[0]) {
                iconFilename = await uploadFileToSupabase(req.files.icon[0], 'banners');
            }
        } else {
            if (body.image !== undefined) imageFilename = body.image || null;
            if (body.icon !== undefined) iconFilename = body.icon || null;
        }

        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.banners WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const { rows: updated } = await query(
            `UPDATE public.banners SET
                title = $1,
                slug = $2,
                image = $3,
                icon = $4,
                status = $5,
                updated_at = NOW()
            WHERE id = $6
            RETURNING *`,
            [
                title,
                slug,
                imageFilename,
                iconFilename,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'Banner updated successfully',
            banner: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleBannerStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: banners } = await query(
            `SELECT id, status FROM public.banners WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (banners.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Banner not found' });
        }

        const newStatus = banners[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.banners SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({
            result: 'success',
            message: `Banner ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteBanner(req, res, next) {
    try {
        const { id } = req.params;

        const { rows: existing } = await query(
            `SELECT image, icon FROM public.banners WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Banner not found' });
        }

        const banner = existing[0];
        const filesToDelete = [banner.image, banner.icon]
            .filter(Boolean)
            .map(f => `banners/${f}`);

        if (filesToDelete.length > 0) {
            try {
                await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
            } catch (storageErr) {
                console.warn('Storage cleanup warning on banner delete:', storageErr.message);
            }
        }

        await query(`DELETE FROM public.banners WHERE id = $1`, [id]);

        return res.json({ result: 'success', message: 'Banner deleted successfully' });
    } catch (err) {
        next(err);
    }
}
