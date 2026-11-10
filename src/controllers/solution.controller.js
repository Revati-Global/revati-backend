import { query } from '../config/db.js';
import {
    serializeSolutions,
    serializeSolutionDetail
} from '../helpers/serializers.js';

export async function getSolutions(req, res, next) {
    try {
        const { rows: solutions } = await query(
            `SELECT * FROM public."solutions" WHERE status = 1 ORDER BY "order" ASC, "id" ASC`
        );

        const serialized = serializeSolutions(solutions);

        return res.json({
            result: 'success',
            solutions: serialized
        });
    } catch (err) {
        next(err);
    }
}

export async function getSolutionBySlug(req, res, next) {
    try {
        const { solution: slug } = req.params;

        const { rows: solutions } = await query(
            `SELECT * FROM public."solutions" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (solutions.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Solution not found'
            });
        }

        const serialized = serializeSolutionDetail(solutions[0]);

        return res.json({
            result: 'success',
            solution: serialized
        });
    } catch (err) {
        next(err);
    }
}
