import { query } from '../config/db.js';

/**
 * PostgreSQL-backed Atomic Rate Limiter
 * Safe across all Vercel serverless function instances
 *
 * @param {string} key - Unique rate limit bucket identifier (e.g., 'login:ip', 'enquiry:ip')
 * @param {number} maxAttempts - Maximum allowed hits within the window
 * @param {number} windowMinutes - Time window duration in minutes
 * @returns {Promise<{ allowed: boolean, current: number, remaining: number, resetTime: Date }>}
 */
export async function checkRateLimit(key, maxAttempts, windowMinutes = 15) {
    const windowMs = windowMinutes * 60 * 1000;
    const now = Date.now();
    // Quantize window to discrete interval to allow atomic upsert
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const windowStart = new Date(windowStartMs).toISOString();
    const resetTime = new Date(windowStartMs + windowMs);

    try {
        const sql = `
            INSERT INTO public."rate_limits" ("key", "window_start", "count")
            VALUES ($1, $2, 1)
            ON CONFLICT ("key", "window_start")
            DO UPDATE SET "count" = public."rate_limits"."count" + 1
            RETURNING "count";
        `;

        const { rows } = await query(sql, [key, windowStart]);
        const currentCount = rows[0]?.count || 1;
        const allowed = currentCount <= maxAttempts;
        const remaining = Math.max(0, maxAttempts - currentCount);

        // Async non-blocking prune of old rate limit records older than 2 hours
        if (Math.random() < 0.05) {
            query(`DELETE FROM public."rate_limits" WHERE "window_start" < NOW() - INTERVAL '2 hours'`).catch(() => {});
        }

        return {
            allowed,
            current: currentCount,
            remaining,
            resetTime
        };
    } catch (err) {
        // Fallback open if database rate limit table is momentarily unreachable
        console.warn('Rate limiter warning (allowing request):', err.message);
        return {
            allowed: true,
            current: 1,
            remaining: maxAttempts - 1,
            resetTime
        };
    }
}
