import { query } from '../config/db.js';
import { serializeBanners } from '../helpers/serializers.js';

export async function getBanners(req, res, next) {
    try {
        const { rows: banners } = await query(
            `SELECT * FROM public."banners" WHERE status = 1 ORDER BY "id" DESC`
        );

        const serialized = serializeBanners(banners);

        return res.json({
            result: 'success',
            banners: serialized
        });
    } catch (err) {
        next(err);
    }
}
