import { config } from './env.js';

/**
 * Production root domains whose apex and any subdomains are permitted.
 */
export const ALLOWED_ROOT_DOMAINS = [
    'revatiglobal.com'
];

/**
 * Bulletproof origin validation:
 * - Allows non-browser / server-to-server requests (no origin)
 * - Allows wildcard '*' if configured
 * - Allows any explicit origin listed in CORS_ORIGIN / ALLOWED_ORIGINS
 * - Allows trusted production root domains and ALL their subdomains (apex + www + subdomains)
 * - Allows localhost and 127.0.0.1 on any port (development)
 * - Allows all trusted Vercel deployments (*.vercel.app preview + production)
 * - Rejects any unknown/arbitrary domains
 *
 * @param {string|undefined} origin
 * @returns {boolean}
 */
export function isAllowedOrigin(origin) {
    // 1. Allow non-browser requests (curl, server-to-server, mobile apps, health checks)
    if (!origin) return true;

    try {
        const url = new URL(origin);
        const hostname = url.hostname.toLowerCase();
        const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();

        // 2. Allow if wildcard '*' is explicitly configured
        if (config.corsOrigins.includes('*')) {
            return true;
        }

        // 3. Allow explicit origins listed in environment variables
        if (config.corsOrigins.some(allowed => allowed.toLowerCase() === normalizedOrigin)) {
            return true;
        }

        // 4. Exact trusted production root domains + their subdomains (apex, www, etc.)
        if (
            ALLOWED_ROOT_DOMAINS.some(
                domain => hostname === domain || hostname.endsWith(`.${domain}`)
            )
        ) {
            return true;
        }

        // 5. Local development origins (localhost & 127.0.0.1 on any port)
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return true;
        }


        return false;
    } catch {
        // Malformed origin URL
        return false;
    }
}

/**
 * Standard Express CORS middleware options
 */
export const corsOptions = {
    origin: (origin, callback) => {
        if (isAllowedOrigin(origin)) {
            return callback(null, true);
        }
        const err = new Error(`CORS policy violation: Origin '${origin}' is not permitted.`);
        err.status = 403;
        return callback(err, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'apikey',
        'x-api-key',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Access-Control-Request-Method',
        'Access-Control-Request-Headers'
    ],
    exposedHeaders: [
        'Content-Length',
        'Content-Type',
        'Content-Disposition'
    ],
    maxAge: 86400, // 24 hours preflight cache
    optionsSuccessStatus: 204
};
