import { query } from '../config/db.js';
import {
    serializeApplications,
    serializeApplicationDetail
} from '../helpers/serializers.js';

export async function getApplications(req, res, next) {
    try {
        const { rows: applications } = await query(
            `SELECT * FROM public."applications" WHERE status = 1 ORDER BY "order" ASC, "id" ASC`
        );

        const serialized = serializeApplications(applications);

        return res.json({
            result: 'success',
            applications: serialized
        });
    } catch (err) {
        next(err);
    }
}

export async function getApplicationBySlug(req, res, next) {
    try {
        const { application: slug } = req.params;

        const { rows: applications } = await query(
            `SELECT * FROM public."applications" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Application not found'
            });
        }

        const serialized = serializeApplicationDetail(applications[0]);

        return res.json({
            result: 'success',
            application: serialized
        });
    } catch (err) {
        next(err);
    }
}
