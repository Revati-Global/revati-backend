import { query } from '../config/db.js';

/**
 * GET /api/cron/keepalive
 * Keeps Supabase free PostgreSQL active and prevents the 7-day inactivity pause.
 * Triggered automatically by Vercel Cron.
 * Requires Authorization: Bearer <CRON_SECRET> header.
 */
export async function cronKeepalive(req, res) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;

    if (cronSecret && cronSecret.trim() !== '') {
        const expectedHeader = `Bearer ${cronSecret.trim()}`;
        if (!authHeader || authHeader !== expectedHeader) {
            return res.status(401).json({
                result: 'error',
                message: 'Unauthorized: Invalid or missing CRON_SECRET.'
            });
        }
    }

    try {
        const start = Date.now();
        const { rows } = await query('SELECT 1 AS alive;');
        const latencyMs = Date.now() - start;

        // Also clean up rate_limits rows older than 24 hours
        await query(`DELETE FROM public."rate_limits" WHERE "window_start" < NOW() - INTERVAL '24 hours'`).catch(() => {});

        return res.status(200).json({
            result: 'success',
            message: 'Supabase database keepalive query executed successfully.',
            db: 'active',
            latencyMs,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Cron keepalive database error:', err.message);
        return res.status(500).json({
            result: 'error',
            message: `Keepalive query failed: ${err.message}`
        });
    }
}
