import { query } from '../config/db.js';
import { checkRateLimit } from '../helpers/rateLimiter.js';
import { dispatchEnquiryAlerts } from '../helpers/email.js';

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

async function verifyTurnstileToken(token, clientIp) {
    const turnstileSecret = process.env.TURNSTILE_SECRET;
    // Turnstile is optional: skip if secret is not configured
    if (!turnstileSecret || turnstileSecret.trim() === '' || turnstileSecret === 'your_turnstile_secret_here') {
        return { success: true, skipped: true };
    }

    if (!token) {
        return { success: false, error: 'Turnstile verification token is missing.' };
    }

    try {
        const formData = new URLSearchParams();
        formData.append('secret', turnstileSecret.trim());
        formData.append('response', token);
        if (clientIp) formData.append('remoteip', clientIp);

        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: formData
        });

        const outcome = await res.json();
        return outcome;
    } catch (err) {
        console.warn('Turnstile verification network error (allowing request):', err.message);
        return { success: true, bypassed: true };
    }
}

export async function createEnquiry(req, res, next) {
    try {
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '127.0.0.1';

        // 1. Rate Limiting: 10 attempts per hour per IP
        const rateCheck = await checkRateLimit(`enquiry:${ip}`, 10, 60);
        if (!rateCheck.allowed) {
            return res.status(429).json({
                result: 'error',
                message: 'Too many requests. Please try submitting your inquiry again in an hour.'
            });
        }

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
            source = 'website',
            // Anti-Spam Fields
            _hp,            // Honeypot field (must be empty)
            _t,             // Submission timestamp (minimum fill time check)
            turnstile_token // Optional Cloudflare Turnstile token
        } = req.body || {};

        // 2. Honeypot check (bots fill hidden inputs)
        if (_hp && _hp.trim() !== '') {
            // Silently reject bot submissions with a fake success
            return res.status(200).json({
                result: 'success',
                message: 'Thank you for your enquiry.'
            });
        }

        // 3. Minimum fill time check (minimum 3 seconds for human entry)
        if (_t) {
            const formLoadTime = parseInt(_t, 10);
            if (!isNaN(formLoadTime)) {
                const elapsedSeconds = (Date.now() - formLoadTime) / 1000;
                if (elapsedSeconds < 2) {
                    return res.status(400).json({
                        result: 'error',
                        message: 'Submission was too fast. Please take a moment to review your details.'
                    });
                }
            }
        }

        // 4. Cloudflare Turnstile Verification
        const turnstileResult = await verifyTurnstileToken(turnstile_token, ip);
        if (!turnstileResult.success) {
            return res.status(400).json({
                result: 'error',
                message: 'Bot verification failed. Please refresh the page and try again.'
            });
        }

        // 5. Field validations
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

        const insertSql = `
            INSERT INTO public.enquiries (
                name, email, phone, state, city, country,
                interest, project_type, message, status, notify_status, source, ip,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6,
                $7, $8, $9, 'new', 'pending', $10, $11,
                NOW(), NOW()
            ) RETURNING id, name, email, phone, status, notify_status, created_at;
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
        const newEnquiry = rows[0];

        // 6. Non-blocking Email Dispatch (updates notify_status)
        const enquiryPayload = {
            id: newEnquiry.id,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            state,
            city,
            country,
            interest,
            project_type,
            message: message.trim()
        };

        // Execute email dispatch asynchronously
        (async () => {
            try {
                const alertResult = await dispatchEnquiryAlerts(enquiryPayload);
                const finalStatus = (alertResult.company?.success) ? 'sent' : 'failed';
                await query(`UPDATE public.enquiries SET notify_status = $1, updated_at = NOW() WHERE id = $2`, [finalStatus, newEnquiry.id]);
            } catch (err) {
                console.error('Async alert dispatch failed:', err.message);
                await query(`UPDATE public.enquiries SET notify_status = 'failed', updated_at = NOW() WHERE id = $1`, [newEnquiry.id]).catch(() => {});
            }
        })();

        return res.status(201).json({
            result: 'success',
            message: 'Thank you! Your enquiry has been received. Our engineering team will contact you shortly.',
            enquiry: newEnquiry
        });
    } catch (err) {
        next(err);
    }
}
