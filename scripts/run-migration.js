import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in environment.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Testing connection to Supabase database...');
    const testResult = await pool.query('SELECT NOW() as now, current_database() as db');
    console.log(`Connected successfully! Server time: ${testResult.rows[0].now}, Database: ${testResult.rows[0].db}`);

    const sqlPath = path.resolve('database', 'migration.sql');
    console.log(`Reading migration script from ${sqlPath}...`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing database/migration.sql on Supabase...');
    await pool.query(sql);
    console.log('Migration completed successfully!');

    // Verify tables created
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`Total public tables present: ${tablesRes.rows.length}`);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log('Tables:', tableNames.join(', '));

  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
