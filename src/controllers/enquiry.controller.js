import { query } from '../config/db.js';

export function isValidPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    // Indian mobile: 10 digits starting with 6-9, optionally prefixed with +91, 91, or 0
    const indianRegex = /^(?:\+?91|0)?[6-9]\d{9}$/;
    // International standard format: 7 to 15 digits, optionally with leading +
    const intlRegex = /^\+?[1-9]\d{6,14}$/;
    return indianRegex.test(cleaned) || intlRegex.test(cleaned);
}

export function isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
}

export async function createEnquiry(req, res, next) {
    try {
        const {
            name,
            email,
            phone,
            state,
            city,
            country = 'India',
            interest,
            project_type,
            message,
            source = 'website'
        } = req.body || {};

        if (!name || name.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Name is required' });
        }
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ result: 'error', message: 'A valid email address is required' });
        }
        if (!phone || !isValidPhone(phone)) {
            return res.status(400).json({
                result: 'error',
                message: 'A valid 10-digit Indian phone number or international contact number is required'
            });
        }
        if (!message || message.trim() === '') {
            return res.status(400).json({ result: 'error', message: 'Message / inquiry details are required' });
        }

        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;

        const insertSql = `
            INSERT INTO public.enquiries (
                name, email, phone, state, city, country,
                interest, project_type, message, status, source, ip,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, 'new', $10, $11,
                NOW(), NOW()
            ) RETURNING id, name, email, phone, status, created_at;
        `;

        const values = [
            name.trim(),
            email.trim().toLowerCase(),
            phone.trim(),
            state ? state.trim() : null,
            city ? city.trim() : null,
            country ? country.trim() : 'India',
            interest ? interest.trim() : null,
            project_type ? project_type.trim() : null,
            message.trim(),
            source || 'website',
            ip
        ];

        const { rows } = await query(insertSql, values);

        return res.status(201).json({
            result: 'success',
            message: 'Thank you! Your enquiry has been received. Our engineering team will contact you shortly.',
            enquiry: rows[0]
        });
    } catch (err) {
        next(err);
    }
}
