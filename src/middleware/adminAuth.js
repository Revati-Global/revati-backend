import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../config/db.js';

/**
 * Strict Admin Authentication Middleware
 * 1. Verifies Bearer JWT signature
 * 2. Fetches user and live role directly from PostgreSQL (model_has_roles JOIN roles)
 * 3. Never falls back to default 'admin' or unverified JWT claims
 * 4. Rejects immediately with 401/403 if user or role is invalid
 */
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
                message: 'Invalid or expired session token. Please log in again.'
            });
        }

        if (!decoded || !decoded.userId) {
            return res.status(401).json({
                result: 'error',
                message: 'Malformed token payload'
            });
        }

        // Always query database for live user and role. Do not trust JWT role claim.
        const userSql = `
            SELECT u.id, u.name, u.email, r.name AS role
            FROM public."users" u
            JOIN public."model_has_roles" mhr ON mhr.model_id = u.id AND mhr.model_type = 'App\\Models\\User'
            JOIN public."roles" r ON r.id = mhr.role_id
            WHERE u.id = $1
            LIMIT 1;
        `;

        const { rows } = await query(userSql, [decoded.userId]);

        if (rows.length === 0) {
            return res.status(403).json({
                result: 'error',
                message: 'Access denied: User account not found or has no active role assigned.'
            });
        }

        const dbUser = rows[0];

        if (!dbUser.role) {
            return res.status(403).json({
                result: 'error',
                message: 'Access denied: No role assigned to this account.'
            });
        }

        req.user = {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role
        };

        next();
    } catch (err) {
        next(err);
    }
}

/**
 * Role-based Authorization Middleware
 * Hierarchy:
 * - 'super admin' can access EVERYTHING
 * - Other roles must match one of the allowedRoles explicitly
 *
 * @param {...string} allowedRoles
 */
export function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({
                result: 'error',
                message: 'Access denied: unauthenticated or role missing.'
            });
        }

        const userRole = req.user.role.toLowerCase().trim();

        // super admin always has universal bypass
        if (userRole === 'super admin') {
            return next();
        }

        const normalizedAllowed = allowedRoles.map(r => r.toLowerCase().trim());
        if (normalizedAllowed.includes(userRole)) {
            return next();
        }

        return res.status(403).json({
            result: 'error',
            message: `Forbidden: role '${req.user.role}' does not have permission to access this resource.`
        });
    };
}

export const adminAuth = adminAuthMiddleware;
export default adminAuthMiddleware;
