import { query } from '../config/db.js';
import { serializeIndustries } from '../helpers/serializers.js';

export async function getIndustries(req, res, next) {
    try {
        const { rows: industries } = await query(
            `SELECT * FROM public."industries" WHERE status = 1 ORDER BY "order" ASC, "id" ASC`
        );

        const serialized = serializeIndustries(industries);

        return res.json({
            result: 'success',
            industries: serialized
        });
    } catch (err) {
        next(err);
    }
}
