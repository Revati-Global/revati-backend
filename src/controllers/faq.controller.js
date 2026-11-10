import { query } from '../config/db.js';
import { serializeFaqTypes } from '../helpers/serializers.js';

export async function getFaqs(req, res, next) {
    try {
        const { rows: types } = await query(
            `SELECT * FROM public."faq_types" WHERE status = 1 ORDER BY "id" DESC`
        );

        const { rows: faqs } = await query(
            `SELECT * FROM public."faqs" WHERE status = 1 ORDER BY "id" DESC`
        );

        const serialized = serializeFaqTypes(types, faqs);

        return res.json({
            result: 'success',
            types: serialized
        });
    } catch (err) {
        next(err);
    }
}
