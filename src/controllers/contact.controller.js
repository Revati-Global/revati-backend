import { query } from '../config/db.js';
import { randomUUID } from 'crypto';

export async function submitContact(req, res, next) {
    try {
        const body = req.body || {};
        const errors = {};

        if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
            errors.name = ['The name field is required.'];
        } else if (body.name.length > 255) {
            errors.name = ['The name must not be greater than 255 characters.'];
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!body.email || typeof body.email !== 'string' || body.email.trim() === '') {
            errors.email = ['The email field is required.'];
        } else if (!emailRegex.test(body.email)) {
            errors.email = ['The email must be a valid email address.'];
        } else if (body.email.length > 255) {
            errors.email = ['The email must not be greater than 255 characters.'];
        }

        const phoneDigits = String(body.phone_number || '').trim();
        if (!phoneDigits) {
            errors.phone_number = ['The phone number field is required.'];
        } else if (!/^\d{10}$/.test(phoneDigits)) {
            errors.phone_number = ['The phone number must be 10 digits.'];
        }

        if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
            errors.message = ['The message field is required.'];
        } else if (body.message.length > 1000) {
            errors.message = ['The message must not be greater than 1000 characters.'];
        }

        if (Object.keys(errors).length > 0) {
            return res.json({
                result: 'error',
                message: errors
            });
        }

        const contactSlug = randomUUID();

        await query(
            `INSERT INTO public."contact_forms" (
                slug, name, email, phone_number, message, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
            [
                contactSlug,
                body.name.trim(),
                body.email.trim(),
                phoneDigits,
                body.message.trim()
            ]
        );

        return res.json({
            result: 'success',
            message: "Thank you for contacting us, we 'll be back soon."
        });
    } catch (err) {
        next(err);
    }
}
