import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { config } from '../config/env.js';
import { checkRateLimit } from '../helpers/rateLimiter.js';

export async function login(req, res, next) {
    try {
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';
        const rateLimitKey = `login:${clientIp}`;

        // Rate limit: 5 attempts per 15 minutes
        const rateCheck = await checkRateLimit(rateLimitKey, 5, 15);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                result: 'error',
                message: 'Too many login attempts. Please wait 15 minutes before trying again.'
            });
        }

        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                result: 'error',
                message: 'Email and password are required'
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Query user with their role from database
        const userSql = `
            SELECT u.id, u.name, u.email, u.password, r.name AS role
            FROM public."users" u
            LEFT JOIN public."model_has_roles" mhr ON mhr.model_id = u.id AND mhr.model_type = 'App\\Models\\User'
            LEFT JOIN public."roles" r ON r.id = mhr.role_id
            WHERE LOWER(u.email) = $1
            LIMIT 1;
        `;

        const { rows: users } = await query(userSql, [cleanEmail]);

        // Generic error message for both non-existent user and wrong password
        if (users.length === 0) {
            return res.status(401).json({
                result: 'error',
                message: 'Invalid email or password'
            });
        }

        const user = users[0];

        // Ensure user has an assigned role
        if (!user.role) {
            return res.status(403).json({
                result: 'error',
                message: 'Access denied: account exists but has no active administrative role assigned.'
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                result: 'error',
                message: 'Invalid email or password'
            });
        }

        // Generate JWT with 12 hour expiry as required
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            },
            config.jwtSecret,
            { expiresIn: '12h' }
        );

        return res.json({
            result: 'success',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        next(err);
    }
}

export async function me(req, res, next) {
    try {
        return res.json({
            result: 'success',
            user: req.user
        });
    } catch (err) {
        next(err);
    }
}

export async function logout(req, res, next) {
    try {
        return res.json({
            result: 'success',
            message: 'Logged out successfully'
        });
    } catch (err) {
        next(err);
    }
}
