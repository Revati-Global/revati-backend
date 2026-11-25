import { query } from '../config/db.js';

export async function listSettings(req, res, next) {
    try {
        const { group } = req.query;
        let sql = `SELECT * FROM public.settings`;
        const params = [];

        if (group && group !== 'all') {
            params.push(group.trim());
            sql += ` WHERE "group" = $1`;
        }

        sql += ` ORDER BY id ASC`;

        const { rows: settings } = await query(sql, params);
        return res.json({ result: 'success', settings });
    } catch (err) {
        next(err);
    }
}

export async function updateSettings(req, res, next) {
    try {
        const body = req.body || {};
        const entries = Object.entries(body);

        if (entries.length === 0) {
            return res.status(400).json({ result: 'error', message: 'No settings provided to update' });
        }

        for (const [key, val] of entries) {
            await query(
                `INSERT INTO public.settings ("key", "value", "updated_at")
                 VALUES ($1, $2, NOW())
                 ON CONFLICT ("key") DO UPDATE
                   SET "value" = EXCLUDED."value", "updated_at" = NOW()`,
                [key, val !== null && val !== undefined ? String(val) : '']
            );
        }

        const { rows: updated } = await query(`SELECT * FROM public.settings ORDER BY id ASC`);
        return res.json({
            result: 'success',
            message: 'Settings updated successfully',
            settings: updated
        });
    } catch (err) {
        next(err);
    }
}

