import { query } from '../config/db.js';
import { serializeTestimonials } from '../helpers/serializers.js';

export async function getTestimonials(req, res, next) {
    try {
        const { rows: testimonials } = await query(
            `SELECT * FROM public."testimonials" WHERE status = 1 ORDER BY "id" DESC`
        );

        const serialized = serializeTestimonials(testimonials);

        return res.json({
            result: 'success',
            testimonials: serialized
        });
    } catch (err) {
        next(err);
    }
}
