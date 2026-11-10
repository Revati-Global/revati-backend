import { query } from '../config/db.js';
import {
    serializeServices,
    serializeServiceDetail
} from '../helpers/serializers.js';

export async function getServices(req, res, next) {
    try {
        const { rows: services } = await query(
            `SELECT * FROM public."services" WHERE status = 1 ORDER BY "order" ASC, "id" ASC`
        );

        const serialized = serializeServices(services);

        return res.json({
            result: 'success',
            services: serialized
        });
    } catch (err) {
        next(err);
    }
}

export async function getServiceBySlug(req, res, next) {
    try {
        const { service: slug } = req.params;

        const { rows: services } = await query(
            `SELECT * FROM public."services" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (services.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Service not found'
            });
        }

        const serialized = serializeServiceDetail(services[0]);

        return res.json({
            result: 'success',
            service: serialized
        });
    } catch (err) {
        next(err);
    }
}
