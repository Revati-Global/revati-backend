import { query } from '../config/db.js';

export async function listEnquiries(req, res, next) {
    try {
        const { search, status, limit = 50, offset = 0 } = req.query;
        let sql = `SELECT * FROM public.enquiries WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND (name ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length} OR city ILIKE $${params.length} OR interest ILIKE $${params.length})`;
        }

        if (status && status !== 'all') {
            params.push(status.trim().toLowerCase());
            sql += ` AND status = $${params.length}`;
        }

        // Get total count
        const countSql = sql.replace('SELECT * FROM', 'SELECT COUNT(*)::int as total FROM');
        const countRes = await query(countSql, params);
        const total = countRes.rows[0]?.total || 0;

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(Math.min(parseInt(limit) || 50, 200), parseInt(offset) || 0);

        const { rows: enquiries } = await query(sql, params);

        return res.json({
            result: 'success',
            total,
            enquiries
        });
    } catch (err) {
        next(err);
    }
}

export async function getEnquiry(req, res, next) {
    try {
        const { id } = req.params;
        const { rows } = await query(`SELECT * FROM public.enquiries WHERE id = $1 LIMIT 1`, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Enquiry not found' });
        }

        return res.json({ result: 'success', enquiry: rows[0] });
    } catch (err) {
        next(err);
    }
}

export async function updateEnquiryStatus(req, res, next) {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        const allowed = ['new', 'contacted', 'closed'];
        if (!status || !allowed.includes(status.toLowerCase())) {
            return res.status(400).json({
                result: 'error',
                message: `Status must be one of: ${allowed.join(', ')}`
            });
        }

        const { rows } = await query(
            `UPDATE public.enquiries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
            [status.toLowerCase(), id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ result: 'error', message: 'Enquiry not found' });
        }

        return res.json({
            result: 'success',
            message: `Enquiry status updated to ${rows[0].status}`,
            enquiry: rows[0]
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteEnquiry(req, res, next) {
    try {
        const { id } = req.params;
        const { rowCount } = await query(`DELETE FROM public.enquiries WHERE id = $1`, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ result: 'error', message: 'Enquiry not found' });
        }

        return res.json({ result: 'success', message: 'Enquiry deleted successfully' });
    } catch (err) {
        next(err);
    }
}

export async function exportEnquiriesCsv(req, res, next) {
    try {
        const { rows: enquiries } = await query(
            `SELECT id, name, email, phone, state, city, country, interest, project_type, message, status, source, created_at
             FROM public.enquiries ORDER BY created_at DESC`
        );

        let csv = 'ID,Name,Email,Phone,State,City,Country,Interest,Project Type,Message,Status,Source,Date\n';
        for (const e of enquiries) {
            const dateStr = e.created_at ? new Date(e.created_at).toISOString() : '';
            const sanitize = (str) => `"${(str || '').replace(/"/g, '""')}"`;
            csv += `${e.id},${sanitize(e.name)},${sanitize(e.email)},${sanitize(e.phone)},${sanitize(e.state)},${sanitize(e.city)},${sanitize(e.country)},${sanitize(e.interest)},${sanitize(e.project_type)},${sanitize(e.message)},${sanitize(e.status)},${sanitize(e.source)},"${dateStr}"\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="revati_enquiries.csv"');
        return res.send(csv);
    } catch (err) {
        next(err);
    }
}
