import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../config/db.js';

export async function adminAuthMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                result: 'error',
                message: 'Authentication token required'
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                result: 'error',
                message: 'Invalid token format'
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, config.jwtSecret);
        } catch (jwtErr) {
            return res.status(401).json({
                result: 'error',
                message: 'Invalid or expired session token'
            });
        }

        // Verify user still exists in DB
        const { rows: users } = await query(
            `SELECT id, name, email FROM public."users" WHERE id = $1 LIMIT 1`,
            [decoded.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({
                result: 'error',
                message: 'User account not found'
            });
        }

        req.user = {
            ...users[0],
            role: decoded.role || 'admin'
        };

        next();
    } catch (err) {
        next(err);
    }
}
