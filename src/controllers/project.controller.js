import { query } from '../config/db.js';
import {
    serializeProjects,
    serializeProjectDetail
} from '../helpers/serializers.js';

export async function getProjects(req, res, next) {
    try {
        const { type } = req.query;
        let sql = `SELECT * FROM public."projects" WHERE status = 1`;
        const params = [];

        if (type && type.trim() !== '') {
            params.push(type.trim());
            sql += ` AND project_type = $${params.length}`;
        }

        sql += ` ORDER BY "order" ASC, "id" DESC`;

        const { rows: projects } = await query(sql, params);
        const serialized = serializeProjects(projects);

        return res.json({
            result: 'success',
            projects: serialized
        });
    } catch (err) {
        next(err);
    }
}

export async function getProjectBySlug(req, res, next) {
    try {
        const { project: slug } = req.params;

        const { rows: projects } = await query(
            `SELECT * FROM public."projects" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (projects.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Project not found'
            });
        }

        const serialized = serializeProjectDetail(projects[0]);

        return res.json({
            result: 'success',
            project: serialized
        });
    } catch (err) {
        next(err);
    }
}

