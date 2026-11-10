import { query } from '../config/db.js';
import { serializeFeatures } from '../helpers/serializers.js';

export async function getFeatures(req, res, next) {
    try {
        const { rows: features } = await query(
            `SELECT * FROM public."features" WHERE status = 1 ORDER BY "id" DESC`
        );

        const serialized = serializeFeatures(features);

        return res.json({
            result: 'success',
            features: serialized
        });
    } catch (err) {
        next(err);
    }
}
