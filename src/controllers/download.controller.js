import { query } from '../config/db.js';
import { serializeDownloads } from '../helpers/serializers.js';

export async function getDownloads(req, res, next) {
    try {
        const { category, type } = req.query;
        let sql = `SELECT * FROM public."downloads" WHERE status = 1`;
        const params = [];

        if (category && category.trim() !== '') {
            params.push(category.trim());
            sql += ` AND category = $${params.length}`;
        }

        if (type && type.trim() !== '') {
            params.push(type.trim());
            sql += ` AND type = $${params.length}`;
        }

        sql += ` ORDER BY "order" ASC, "id" DESC`;

        const { rows: downloads } = await query(sql, params);
        const serialized = serializeDownloads(downloads);

        return res.json({
            result: 'success',
            downloads: serialized
        });
    } catch (err) {
        next(err);
    }
}
