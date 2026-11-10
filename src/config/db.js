import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: { rejectUnauthorized: false },
    max: 20, // keep warm pool connections
    min: 2,  // maintain at least 2 active idle connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Handle pool errors gracefully without crashing
pool.on('error', (err) => {
    console.error('Unexpected error on idle pg client:', err.message);
});

export const supabase = (config.supabaseUrl && config.supabaseServiceKey)
    ? createClient(config.supabaseUrl, config.supabaseServiceKey)
    : null;

export async function query(text, params) {
    const client = await pool.connect();
    try {
        const res = await client.query(text, params);
        return res;
    } finally {
        client.release();
    }
}
