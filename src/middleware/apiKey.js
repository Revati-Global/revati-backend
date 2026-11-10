import { config } from '../config/env.js';

export function apiKeyMiddleware(req, res, next) {
    const headerKey = req.headers['apikey'] || req.headers['x-api-key'];

    if (!headerKey) {
        return res.status(401).json({
            result: 'error',
            message: 'API Key is missing'
        });
    }

    if (headerKey !== config.apiKey) {
        return res.status(403).json({
            result: 'error',
            message: 'Invalid API Key'
        });
    }

    next();
}
