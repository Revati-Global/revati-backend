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

// ================= FAQ TYPES =================

export async function listFaqTypes(req, res, next) {
    try {
        const { rows: types } = await query(`
            SELECT ft.*,
                   (SELECT COUNT(*) FROM public.faqs f WHERE f.type_id = ft.id) as faq_count
            FROM public.faq_types ft
            ORDER BY ft.id ASC
        `);

        const formatted = types.map(t => ({
            id: t.id,
            slug: t.slug,
            title: t.title,
            status: t.status ?? 1,
            faq_count: parseInt(t.faq_count || 0),
            created_at: t.created_at,
            updated_at: t.updated_at
        }));

        return res.json({ result: 'success', types: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getFaqType(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: types } = await query(
            `SELECT * FROM public.faq_types WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (types.length === 0) {
            return res.status(404).json({ result: 'error', message: 'FAQ type not found' });
        }

        return res.json({ result: 'success', type: types[0] });
    } catch (err) {
        next(err);
    }
}

export async function createFaqType(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.title || body.title.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'FAQ type title is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.title);
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.faq_types WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        const { rows: inserted } = await query(
            `INSERT INTO public.faq_types (
                slug, user_id, title, status, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.title.trim(),
                body.status !== undefined ? parseInt(body.status) : 1
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'FAQ type created successfully',
            type: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateFaqType(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.faq_types WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'FAQ type not found' });
        }

        const prev = existing[0];
        const title = body.title !== undefined ? body.title.trim() : prev.title;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.faq_types WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const { rows: updated } = await query(
            `UPDATE public.faq_types SET
                title = $1,
                slug = $2,
                status = $3,
                updated_at = NOW()
            WHERE id = $4
            RETURNING *`,
            [
                title,
                slug,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'FAQ type updated successfully',
            type: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteFaqType(req, res, next) {
    try {
        const { id } = req.params;

        // Reassign FAQs with this type to NULL
        await query(`UPDATE public.faqs SET type_id = NULL WHERE type_id = $1`, [id]);
        const { rowCount } = await query(`DELETE FROM public.faq_types WHERE id = $1`, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ result: 'error', message: 'FAQ type not found' });
        }

        return res.json({ result: 'success', message: 'FAQ type deleted successfully' });
    } catch (err) {
        next(err);
    }
}

// ================= FAQS =================

export async function listFaqs(req, res, next) {
    try {
        const { search, type_id, status } = req.query;
        let sql = `
            SELECT f.*,
                   ft.title as type_title,
                   ft.slug as type_slug
            FROM public.faqs f
            LEFT JOIN public.faq_types ft ON ft.id = f.type_id
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (f.question ILIKE $${params.length} OR f.answer ILIKE $${params.length} OR f.slug ILIKE $${params.length})`;
        }

        if (type_id && type_id !== 'all') {
            params.push(parseInt(type_id));
            sql += ` AND f.type_id = $${params.length}`;
        }

        if (status !== undefined && status !== 'all') {
            params.push(parseInt(status));
            sql += ` AND f.status = $${params.length}`;
        }

        sql += ` ORDER BY f.id ASC`;

        const { rows: faqs } = await query(sql, params);

        const formatted = faqs.map(f => ({
            id: f.id,
            slug: f.slug,
            question: f.question,
            answer: f.answer,
            type_id: f.type_id,
            type_title: f.type_title || 'General',
            type_slug: f.type_slug || null,
            name: f.name,
            email: f.email,
            phone_number: f.phone_number,
            status: f.status ?? 1,
            created_at: f.created_at,
            updated_at: f.updated_at
        }));

        return res.json({ result: 'success', faqs: formatted });
    } catch (err) {
        next(err);
    }
}

export async function getFaq(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: faqs } = await query(
            `SELECT f.*,
                    ft.title as type_title,
                    ft.slug as type_slug
             FROM public.faqs f
             LEFT JOIN public.faq_types ft ON ft.id = f.type_id
             WHERE f.id = $1 LIMIT 1`,
            [id]
        );

        if (faqs.length === 0) {
            return res.status(404).json({ result: 'error', message: 'FAQ not found' });
        }

        return res.json({ result: 'success', faq: faqs[0] });
    } catch (err) {
        next(err);
    }
}

export async function createFaq(req, res, next) {
    try {
        const body = req.body || {};
        if (!body.question || body.question.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'FAQ question is required' });
        }
        if (!body.answer || body.answer.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'FAQ answer is required' });
        }

        let slug = body.slug ? slugify(body.slug) : slugify(body.question.slice(0, 50));
        const { rows: existingSlug } = await query(
            `SELECT id FROM public.faqs WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (existingSlug.length > 0) {
            slug = `${slug}-${Date.now()}`;
        }

        const typeId = body.type_id ? parseInt(body.type_id) : 1;

        const { rows: inserted } = await query(
            `INSERT INTO public.faqs (
                slug, user_id, question, answer, type_id,
                name, email, phone_number, status, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9, NOW(), NOW()
            ) RETURNING *`,
            [
                slug,
                req.user?.id ? parseInt(req.user.id) : 1,
                body.question.trim(),
                body.answer.trim(),
                typeId,
                body.name || null,
                body.email || null,
                body.phone_number || null,
                body.status !== undefined ? parseInt(body.status) : 1
            ]
        );

        return res.status(201).json({
            result: 'success',
            message: 'FAQ created successfully',
            faq: inserted[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function updateFaq(req, res, next) {
    try {
        const { id } = req.params;
        const body = req.body || {};

        const { rows: existing } = await query(
            `SELECT * FROM public.faqs WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ result: 'error', message: 'FAQ not found' });
        }

        const prev = existing[0];
        const question = body.question !== undefined ? body.question.trim() : prev.question;
        const answer = body.answer !== undefined ? body.answer.trim() : prev.answer;
        let slug = body.slug !== undefined ? slugify(body.slug) : prev.slug;

        if (slug !== prev.slug) {
            const { rows: slugCheck } = await query(
                `SELECT id FROM public.faqs WHERE slug = $1 AND id != $2 LIMIT 1`,
                [slug, id]
            );
            if (slugCheck.length > 0) {
                slug = `${slug}-${Date.now()}`;
            }
        }

        const typeId = body.type_id !== undefined ? (body.type_id ? parseInt(body.type_id) : null) : prev.type_id;

        const { rows: updated } = await query(
            `UPDATE public.faqs SET
                question = $1,
                answer = $2,
                slug = $3,
                type_id = $4,
                name = $5,
                email = $6,
                phone_number = $7,
                status = $8,
                updated_at = NOW()
            WHERE id = $9
            RETURNING *`,
            [
                question,
                answer,
                slug,
                typeId,
                body.name !== undefined ? body.name : prev.name,
                body.email !== undefined ? body.email : prev.email,
                body.phone_number !== undefined ? body.phone_number : prev.phone_number,
                body.status !== undefined ? parseInt(body.status) : prev.status,
                id
            ]
        );

        return res.json({
            result: 'success',
            message: 'FAQ updated successfully',
            faq: updated[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function toggleFaqStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: faqs } = await query(
            `SELECT id, status FROM public.faqs WHERE id = $1 LIMIT 1`,
            [id]
        );
        if (faqs.length === 0) {
            return res.status(404).json({ result: 'error', message: 'FAQ not found' });
        }

        const newStatus = faqs[0].status === 1 ? 0 : 1;
        await query(`UPDATE public.faqs SET status = $1, updated_at = NOW() WHERE id = $2`, [newStatus, id]);

        return res.json({
            result: 'success',
            message: `FAQ ${newStatus === 1 ? 'activated' : 'deactivated'} successfully`,
            status: newStatus
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteFaq(req, res, next) {
    try {
        const { id } = req.params;
        const { rowCount } = await query(`DELETE FROM public.faqs WHERE id = $1`, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ result: 'error', message: 'FAQ not found' });
        }

        return res.json({ result: 'success', message: 'FAQ deleted successfully' });
    } catch (err) {
        next(err);
    }
}
