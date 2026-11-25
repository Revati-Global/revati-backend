import { pool } from '../src/config/db.js';

async function check() {
  const t = await pool.query('SELECT id, full_name, status FROM public.testimonials');
  console.log('Testimonials in DB:', t.rows);

  const p = await pool.query('SELECT id, title, status FROM public.projects');
  console.log('Projects in DB:', p.rows);

  process.exit(0);
}

check();
