import { query } from '../config/db.js';

export async function listContacts(req, res, next) {
    try {
        const { search } = req.query;
        let sql = `SELECT * FROM public.contact_forms WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone_number ILIKE $${params.length} OR message ILIKE $${params.length})`;
        }

        sql += ` ORDER BY id DESC`;

        const { rows: contacts } = await query(sql, params);

        return res.json({ result: 'success', contacts });
    } catch (err) {
        next(err);
    }
}

export async function getContact(req, res, next) {
    try {
        const { id } = req.params;
        const { rows: contacts } = await query(
            `SELECT * FROM public.contact_forms WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (contacts.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Inquiry not found' });
        }

        return res.json({ result: 'success', contact: contacts[0] });
    } catch (err) {
        next(err);
    }
}

export async function deleteContact(req, res, next) {
    try {
        const { id } = req.params;
        const { rowCount } = await query(`DELETE FROM public.contact_forms WHERE id = $1`, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ result: 'error', message: 'Inquiry not found' });
        }

        return res.json({ result: 'success', message: 'Inquiry deleted successfully' });
    } catch (err) {
        next(err);
    }
}
