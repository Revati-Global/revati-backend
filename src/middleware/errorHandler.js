import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) {
    // Log detailed server-side error with stack trace for server monitoring
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err.stack || err);

    // If headers already sent, delegate to default express handler
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.status || 500;

    // Client-side validation / operational errors (< 500) preserve their specific message
    if (statusCode < 500) {
        return res.status(statusCode).json({
            result: 'error',
            message: err.message || 'Bad Request'
        });
    }

    // Uncaught 500 server / database exceptions: sanitize in production
    const isProduction = config.nodeEnv === 'production';
    return res.status(500).json({
        result: 'error',
        message: isProduction ? 'Internal Server Error' : (err.message || 'Internal Server Error'),
        ...(isProduction ? {} : { stack: err.stack })
    });
}
