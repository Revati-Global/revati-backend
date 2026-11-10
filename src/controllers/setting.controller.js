import { query } from '../config/db.js';
import { serializeSettings } from '../helpers/serializers.js';

export async function getPublicSettings(req, res, next) {
    try {
        const { rows } = await query(`SELECT "key", "value" FROM public."settings"`);
        const settings = serializeSettings(rows);

        return res.json({
            result: 'success',
            settings
        });
    } catch (err) {
        next(err);
    }
}
