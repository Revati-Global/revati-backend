import { query } from '../config/db.js';
import { serializeReferences } from '../helpers/serializers.js';

export async function getReferences(req, res, next) {
    try {
        const { rows: references } = await query(
            `SELECT * FROM public."references" WHERE status = 1 ORDER BY "id" ASC`
        );

        const serialized = serializeReferences(references);

        return res.json({
            result: 'success',
            references: serialized
        });
    } catch (err) {
        next(err);
    }
}
