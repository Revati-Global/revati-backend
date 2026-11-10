import { query } from '../config/db.js';
import { serializeDownloads } from '../helpers/serializers.js';

export async function getDownloads(req, res, next) {
    try {
        const { rows: downloads } = await query(
            `SELECT * FROM public."downloads" WHERE status = 1 ORDER BY "id" DESC`
        );

        const serialized = serializeDownloads(downloads);

        return res.json({
            result: 'success',
            downloads: serialized
        });
    } catch (err) {
        next(err);
    }
}
