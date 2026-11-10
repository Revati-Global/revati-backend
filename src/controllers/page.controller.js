import { query } from '../config/db.js';
import { serializePage } from '../helpers/serializers.js';

export async function getPageBySlug(req, res, next) {
    try {
        const { page: slug } = req.params;

        const { rows: pages } = await query(
            `SELECT * FROM public."pages" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (pages.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Page not found'
            });
        }

        const serialized = serializePage(pages[0]);

        return res.json({
            result: 'success',
            page: serialized
        });
    } catch (err) {
        next(err);
    }
}
