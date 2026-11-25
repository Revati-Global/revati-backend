import app from './app.js';
import { config } from './config/env.js';
import { pool } from './config/db.js';

const PORT = config.port;

// Test DB connection before listening
async function startServer() {
    try {
        const client = await pool.connect();
        console.log('Successfully connected to Supabase PostgreSQL database.');
        client.release();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Revati Global API Server is running on port ${PORT}`);
            console.log(`Environment: ${config.nodeEnv}`);
            console.log(`API Base URL: http://localhost:${PORT}/api`);
        });
    } catch (err) {
        console.error('Failed to connect to the database:', err.message);
        process.exit(1);
    }
}

startServer();
