import { query } from '../config/db.js';

export async function listSubscribers(req, res, next) {
    try {
        const { search } = req.query;
        let sql = `SELECT * FROM public.subscribers WHERE 1=1`;
        const params = [];

        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            sql += ` AND email ILIKE $${params.length}`;
        }

        sql += ` ORDER BY id DESC`;

        const { rows: subscribers } = await query(sql, params);

        return res.json({ result: 'success', subscribers });
    } catch (err) {
        next(err);
    }
}

export async function exportSubscribersCsv(req, res, next) {
    try {
        const { rows: subscribers } = await query(
            `SELECT id, email, status, created_at FROM public.subscribers ORDER BY id ASC`
        );

        let csv = 'ID,Email,Status,Subscribed At\n';
        for (const sub of subscribers) {
            const dateStr = sub.created_at ? new Date(sub.created_at).toISOString() : '';
            const statusStr = sub.status === 1 ? 'Active' : 'Inactive';
            csv += `${sub.id},"${sub.email}",${statusStr},"${dateStr}"\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="revati_subscribers.csv"');
        return res.send(csv);
    } catch (err) {
        next(err);
    }
}

export async function deleteSubscriber(req, res, next) {
    try {
        const { id } = req.params;
        const { rowCount } = await query(`DELETE FROM public.subscribers WHERE id = $1`, [id]);

        if (rowCount === 0) {
            return res.status(404).json({ result: 'error', message: 'Subscriber not found' });
        }

        return res.json({ result: 'success', message: 'Subscriber removed successfully' });
    } catch (err) {
        next(err);
    }
}
