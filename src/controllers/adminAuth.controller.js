import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { config } from '../config/env.js';

export async function login(req, res, next) {
    try {
        const { email, password } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({
                result: 'error',
                message: 'Email and password are required'
            });
        }

        const { rows: users } = await query(
            `SELECT id, name, email, password FROM public."users" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [email.trim()]
        );

        if (users.length === 0) {
            return res.status(401).json({
                result: 'error',
                message: 'Invalid email or password'
            });
        }

        const user = users[0];

        // Compare password with bcrypt hash from Laravel ($2y$ or standard)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                result: 'error',
                message: 'Invalid email or password'
            });
        }

        // Fetch user role from model_has_roles / roles
        let role = 'admin';
        try {
            const { rows: roles } = await query(
                `SELECT r.name as role_name 
                 FROM public."model_has_roles" mhr 
                 JOIN public."roles" r ON r.id = mhr.role_id 
                 WHERE mhr.model_id = $1 
                 LIMIT 1`,
                [user.id]
            );
            if (roles.length > 0 && roles[0].role_name) {
                role = roles[0].role_name;
            }
        } catch (roleErr) {
            console.warn('Role lookup warning (defaulting to admin):', roleErr.message);
        }

        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                name: user.name,
                role
            },
            config.jwtSecret,
            { expiresIn: '7d' }
        );

        return res.json({
            result: 'success',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role
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
