import { query } from '../config/db.js';

export async function healthCheck(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    try {
        const start = Date.now();
        await query('SELECT 1 AS alive;');
        const latencyMs = Date.now() - start;

        return res.status(200).json({
            status: 'ok',
            db: 'connected',
            latencyMs,
            time: new Date().toISOString()
        });
    } catch (err) {
        console.error('Database health check failed:', err.message);
        return res.status(503).json({
            status: 'degraded',
            db: 'disconnected',
            error: err.message,
            time: new Date().toISOString()
        });
    }
}
