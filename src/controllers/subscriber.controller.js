import { query } from '../config/db.js';
import { randomUUID } from 'crypto';

export async function subscribe(req, res, next) {
    try {
        const body = req.body || {};
        const errors = {};

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!body.email || typeof body.email !== 'string' || body.email.trim() === '') {
            errors.email = ['The email field is required.'];
        } else if (!emailRegex.test(body.email)) {
            errors.email = ['The email must be a valid email address.'];
        } else if (body.email.length > 255) {
            errors.email = ['The email must not be greater than 255 characters.'];
        } else {
            const { rows: existing } = await query(
                `SELECT id FROM public."subscribers" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
                [body.email.trim()]
            );

            if (existing.length > 0) {
                errors.email = ['The email has already been taken.'];
            }
        }

        if (Object.keys(errors).length > 0) {
            return res.json({
                result: 'error',
                message: errors
            });
        }

        const subscriberSlug = randomUUID();

        await query(
            `INSERT INTO public."subscribers" (
                slug, email, status, created_at, updated_at
            ) VALUES ($1, $2, 1, NOW(), NOW())`,
            [
                subscriberSlug,
                body.email.trim().toLowerCase()
            ]
        );

        return res.json({
            result: 'success',
            message: 'You are successfully Subscribed'
        });
    } catch (err) {
        next(err);
    }
}
