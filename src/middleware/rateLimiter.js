import rateLimit from 'express-rate-limit';

// Rate limiter for Admin Login (brute force protection: max 5 attempts per 15 min per IP)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return res.status(429).json({
            result: 'error',
            message: 'Too many login attempts. Please try again after 15 minutes.'
        });
    }
});

// Rate limiter for Public Form submissions (spam protection: max 10 submissions per hour per IP)
export const publicFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        return res.status(429).json({
            result: 'error',
            message: 'Too many submissions from your IP address. Please try again later.'
        });
    }
});
