import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

const { Pool } = pg;

/**
 * PostgreSQL Connection Pool for Supabase & Vercel Serverless
 * - Uses Supabase Transaction Pooler (port 6543)
 * - Max 1 connection per serverless function instance to prevent pool exhaustion
 * - Short idle timeout to release connections back to pooler immediately
 * - No named prepared statements (safe for transaction mode pooler)
 */
export const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 1, // Single connection per serverless instance (critical for Vercel + Supabase pooler)
    min: 0,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 5000
});

// Handle idle client errors gracefully without crashing the process
pool.on('error', (err) => {
    console.error('Database pool client error:', err.message);
});

export const supabase = (config.supabaseUrl && config.supabaseServiceKey)
    ? createClient(config.supabaseUrl, config.supabaseServiceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false
        }
    })
    : null;

/**
 * Execute parameterized query safely using the pool
 * Safe with transaction-mode poolers
 *
 * @param {string} text - SQL statement with positional parameters ($1, $2)
 * @param {Array} [params] - Parameter values
 */
export async function query(text, params) {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res;
    } finally {
        client.release();
    }
}
