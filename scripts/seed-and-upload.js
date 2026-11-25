import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mime from 'mime-types';
import { pool } from '../src/config/db.js';
import { supabase, BUCKET_NAME } from '../src/config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlPath = 'D:/Businesses/Agency-BrandNest/Websites-V2/FutureTech-V2/futuretechniques_admin.sql';
if (!fs.existsSync(sqlPath)) {
  console.error('SQL dump not found at', sqlPath);
  process.exit(1);
}

const content = fs.readFileSync(sqlPath, 'utf8');

function cleanText(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/Future Techniques Pvt\. Ltd\./gi, 'Revati Global Pvt. Ltd.')
    .replace(/Future Techniques/gi, 'Revati Global')
    .replace(/FutureTek/gi, 'Revati Global')
    .replace(/Futuretek/gi, 'Revati Global')
    .replace(/FTPL/gi, 'Revati Global')
    .replace(/Kathmandu, Nepal/gi, 'Kolkata, West Bengal, India')
    .replace(/Kathmandu/gi, 'Kolkata')
    .replace(/Nepal/gi, 'India')
    .replace(/info@futuretechniques\.com\.np/gi, 'info@revatiglobal.com')
    .replace(/futuretechniques\.com\.np/gi, 'revatiglobal.com')
    .replace(/GPO Box \d+/gi, 'Kolkata');
}

function cleanVal(val) {
  val = val.trim();
  if (val.toUpperCase() === 'NULL') return null;
  if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
    let inner = val.slice(1, -1);
    inner = inner.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\\\/g, '\\');
    return cleanText(inner);
  }
  const num = Number(val);
  return isNaN(num) ? val : num;
}

function parseTableRows(tableName) {
  const pattern = new RegExp(`INSERT INTO \`${tableName}\` \\(([^)]+)\\) VALUES([\\s\\S]+?);\\n`, 'i');
  const match = content.match(pattern);
  if (!match) return { columns: [], rows: [] };

  const columns = match[1].split(',').map(c => c.trim().replace(/`/g, ''));
  const rawValues = match[2].trim();

  const rows = [];
  let inString = false;
  let stringChar = '';
  let isEscaped = false;
  let depth = 0;
  let currentVal = '';
  let currentRow = [];

  for (let i = 0; i < rawValues.length; i++) {
    const char = rawValues[i];

    if (isEscaped) {
      currentVal += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      currentVal += char;
      continue;
    }

    if (inString) {
      if (char === stringChar) {
        inString = false;
      }
      currentVal += char;
      continue;
    }

    if (char === "'" || char === '"') {
      inString = true;
      stringChar = char;
      currentVal += char;
      continue;
    }

    if (char === '(' && depth === 0) {
      depth = 1;
      currentVal = '';
      currentRow = [];
      continue;
    }

    if (char === ')' && depth === 1) {
      depth = 0;
      currentRow.push(cleanVal(currentVal));
      currentVal = '';
      if (currentRow.length === columns.length) {
        // Map as object { colName: val }
        const obj = {};
        columns.forEach((col, idx) => {
          obj[col] = currentRow[idx];
        });
        rows.push(obj);
      }
      currentRow = [];
      continue;
    }

    if (char === ',' && depth === 1) {
      currentRow.push(cleanVal(currentVal));
      currentVal = '';
      continue;
    }

    if (depth === 1) {
      currentVal += char;
    }
  }

  return { columns, rows };
}

async function uploadImagesToSupabase() {
  console.log('--- Uploading assets to Supabase Storage: revati-media ---');
  const baseImgDir = path.join(__dirname, '../public/frontend/images');
  if (!fs.existsSync(baseImgDir)) {
    console.log('No local frontend/images folder found, skipping storage upload');
    return;
  }

  const folders = fs.readdirSync(baseImgDir);
  let totalUploaded = 0;

  for (const f of folders) {
    const fullFolderPath = path.join(baseImgDir, f);
    if (!fs.statSync(fullFolderPath).isDirectory()) continue;

    // Folder alias: services->solutions, references->projects, industries->applications
    const targetFolder = f === 'services' ? 'solutions' :
                         f === 'references' ? 'projects' :
                         f === 'industries' ? 'applications' : f;

    const files = fs.readdirSync(fullFolderPath);
    for (const file of files) {
      const filePath = path.join(fullFolderPath, file);
      if (!fs.statSync(filePath).isFile()) continue;

      const fileBuffer = fs.readFileSync(filePath);
      const contentType = mime.lookup(filePath) || 'application/octet-stream';

      // Upload both under targetFolder and original folder for fallback compatibility
      const pathsToUpload = [`${targetFolder}/${file}`];
      if (targetFolder !== f) {
        pathsToUpload.push(`${f}/${file}`);
      }

      for (const p of pathsToUpload) {
        try {
          const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(p, fileBuffer, {
              contentType,
              upsert: true,
              cacheControl: '31536000'
            });

          if (error) {
            console.warn(`  Failed upload: ${p}`, error.message);
          } else {
            totalUploaded++;
          }
        } catch (err) {
          console.warn(`  Error upload: ${p}`, err.message);
        }
      }
    }
  }
  console.log(`✓ Uploaded/synced ${totalUploaded} files to Supabase Storage: ${BUCKET_NAME}`);
}

async function seedDatabase() {
  console.log('--- Seeding Database from Futuretek Data ---');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. FAQ TYPES
    const faqTypesData = parseTableRows('faq_types');
    for (const row of faqTypesData.rows) {
      await client.query(`
        INSERT INTO public.faq_types (id, slug, user_id, title, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status;
      `, [row.id, row.slug, row.user_id || 1, row.title, row.status ?? 1, row.created_at || new Date(), row.updated_at || new Date()]);
    }
    console.log(`✓ Seeded ${faqTypesData.rows.length} faq_types`);

    // 2. FAQS
    const faqsData = parseTableRows('faqs');
    for (const row of faqsData.rows) {
      await client.query(`
        INSERT INTO public.faqs (id, slug, user_id, question, answer, type_id, name, email, phone_number, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET question = EXCLUDED.question, answer = EXCLUDED.answer, status = EXCLUDED.status;
      `, [row.id, row.slug, row.user_id || 1, row.question, row.answer, row.type_id || null, row.name || null, row.email || null, row.phone_number || null, row.status ?? 1, row.created_at || new Date(), row.updated_at || new Date()]);
    }
    console.log(`✓ Seeded ${faqsData.rows.length} faqs`);

    // 3. CATEGORIES
    const catData = parseTableRows('categories');
    for (const row of catData.rows) {
      await client.query(`
        INSERT INTO public.categories (id, slug, user_id, title, parent_id, image, description, navigation_status, home_status, seo_title, seo_keyword, seo_description, status, "order", created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          image = EXCLUDED.image,
          description = EXCLUDED.description,
          navigation_status = EXCLUDED.navigation_status,
          home_status = EXCLUDED.home_status,
          status = EXCLUDED.status,
          "order" = EXCLUDED."order";
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.parent_category ? Number(row.parent_category) || null : null,
        row.image || null,
        row.description || null,
        row.navigation_status ?? 0,
        row.home_status ?? 0,
        row.seo_title || null,
        row.seo_keyword || null,
        row.seo_description || null,
        row.status ?? 1,
        row.order ?? 0,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${catData.rows.length} categories`);

    // 4. PRODUCTS
    const prodData = parseTableRows('products');
    for (const row of prodData.rows) {
      await client.query(`
        INSERT INTO public.products (id, slug, user_id, category_id, title, description, feature_and_benefit, benefit_description, benefit_image, additionals, catalogue, image, status, "order", seo_title, seo_description, seo_keywords, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          feature_and_benefit = EXCLUDED.feature_and_benefit,
          benefit_description = EXCLUDED.benefit_description,
          benefit_image = EXCLUDED.benefit_image,
          additionals = EXCLUDED.additionals,
          catalogue = EXCLUDED.catalogue,
          image = EXCLUDED.image,
          status = EXCLUDED.status,
          "order" = EXCLUDED."order";
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.category_id || null,
        row.title,
        row.description || '',
        row.feature_and_benefit || null,
        row.benefit_description || null,
        row.benefit_image || null,
        row.additionals ? (typeof row.additionals === 'string' ? row.additionals : JSON.stringify(row.additionals)) : null,
        row.catalogue || null,
        row.image || null,
        row.status ?? 1,
        row.order ?? 0,
        row.seo_title || null,
        row.seo_description || null,
        row.seo_keywords || row.seo_keyword || null,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${prodData.rows.length} products`);

    // 5. SOLUTIONS (from services)
    const servData = parseTableRows('services');
    for (const row of servData.rows) {
      await client.query(`
        INSERT INTO public.solutions (id, slug, user_id, title, image, summary, description, features, status, "order", seo_title, seo_keyword, seo_description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          image = EXCLUDED.image,
          summary = EXCLUDED.summary,
          description = EXCLUDED.description,
          features = EXCLUDED.features,
          status = EXCLUDED.status,
          "order" = EXCLUDED."order";
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.image || null,
        row.summary || null,
        row.description || null,
        row.features ? (typeof row.features === 'string' ? row.features : JSON.stringify(row.features)) : null,
        row.status ?? 1,
        row.order ?? 0,
        row.seo_title || null,
        row.seo_keyword || null,
        row.seo_description || null,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${servData.rows.length} solutions (from services)`);

    // 6. PROJECTS (from references)
    const refData = parseTableRows('references');
    for (const row of refData.rows) {
      await client.query(`
        INSERT INTO public.projects (id, slug, user_id, title, image, images, description, status, seo_title, seo_keyword, seo_description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          image = EXCLUDED.image,
          images = EXCLUDED.images,
          description = EXCLUDED.description,
          status = EXCLUDED.status;
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.image || null,
        row.images ? (typeof row.images === 'string' ? row.images : JSON.stringify(row.images)) : null,
        row.description || null,
        row.status ?? 1,
        row.seo_title || null,
        row.seo_keyword || null,
        row.seo_description || null,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${refData.rows.length} projects (from references)`);

    // 7. APPLICATIONS (from industries)
    const indData = parseTableRows('industries');
    for (const row of indData.rows) {
      await client.query(`
        INSERT INTO public.applications (id, slug, user_id, title, image, description, status, "order", created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          image = EXCLUDED.image,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          "order" = EXCLUDED."order";
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.image || null,
        row.description || null,
        row.status ?? 1,
        row.order ?? 0,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${indData.rows.length} applications (from industries)`);

    // 8. BANNERS
    const bannerData = parseTableRows('banners');
    for (const row of bannerData.rows) {
      await client.query(`
        INSERT INTO public.banners (id, slug, user_id, title, image, icon, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          image = EXCLUDED.image,
          icon = EXCLUDED.icon,
          status = EXCLUDED.status;
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.image || null,
        row.icon || null,
        row.status ?? 1,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${bannerData.rows.length} banners`);

    // 9. FEATURES
    const featData = parseTableRows('features');
    for (const row of featData.rows) {
      await client.query(`
        INSERT INTO public.features (id, slug, user_id, title, image, description, status, "order", link, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          image = EXCLUDED.image,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          "order" = EXCLUDED."order",
          link = EXCLUDED.link;
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.image || null,
        row.description || null,
        row.status ?? 1,
        row.order ?? 0,
        row.link || null,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${featData.rows.length} features`);

    // 10. TESTIMONIALS
    const testData = parseTableRows('testimonials');
    for (const row of testData.rows) {
      await client.query(`
        INSERT INTO public.testimonials (id, slug, user_id, full_name, company_name, position, image, message, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          company_name = EXCLUDED.company_name,
          position = EXCLUDED.position,
          image = EXCLUDED.image,
          message = EXCLUDED.message,
          status = EXCLUDED.status;
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.full_name,
        row.company_name || null,
        row.position || null,
        row.image || null,
        row.message,
        row.status ?? 1,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${testData.rows.length} testimonials`);

    // 11. DOWNLOADS
    const dlData = parseTableRows('downloads');
    for (const row of dlData.rows) {
      await client.query(`
        INSERT INTO public.downloads (id, slug, user_id, title, image, status, "order", created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          image = EXCLUDED.image,
          status = EXCLUDED.status,
          "order" = EXCLUDED."order";
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.image || null,
        row.status ?? 1,
        row.order ?? 0,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${dlData.rows.length} downloads`);

    // 12. BLOG CATEGORIES
    const blogCatData = parseTableRows('blog_categories');
    for (const row of blogCatData.rows) {
      await client.query(`
        INSERT INTO public.blog_categories (id, slug, user_id, title, status, image, description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, status = EXCLUDED.status;
      `, [row.id, row.slug, row.user_id || 1, row.title, row.status ?? 1, row.image || null, row.description || null, row.created_at || new Date(), row.updated_at || new Date()]);
    }
    console.log(`✓ Seeded ${blogCatData.rows.length} blog_categories`);

    // 13. BLOGS
    const blogData = parseTableRows('blogs');
    for (const row of blogData.rows) {
      await client.query(`
        INSERT INTO public.blogs (id, slug, user_id, category_id, title, summary, description, image, status, seo_title, seo_keyword, seo_description, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          description = EXCLUDED.description,
          image = EXCLUDED.image,
          status = EXCLUDED.status;
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.category_id || null,
        row.title,
        row.summary || null,
        row.description || null,
        row.image || null,
        row.status ?? 1,
        row.seo_title || null,
        row.seo_keyword || null,
        row.seo_description || null,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${blogData.rows.length} blogs`);

    // 14. PAGES
    const pageData = parseTableRows('pages');
    for (const row of pageData.rows) {
      await client.query(`
        INSERT INTO public.pages (id, slug, user_id, title, summary, description, image, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          description = EXCLUDED.description,
          status = EXCLUDED.status;
      `, [
        row.id,
        row.slug,
        row.user_id || 1,
        row.title,
        row.summary || null,
        row.description || null,
        row.image || null,
        row.status ?? 1,
        row.created_at || new Date(),
        row.updated_at || new Date()
      ]);
    }
    console.log(`✓ Seeded ${pageData.rows.length} pages`);

    // 15. SETTINGS: Kolkata Address & Company Info
    await client.query(`
      INSERT INTO public.settings (key, value) VALUES
        ('site_name', 'Revati Global'),
        ('company_name', 'Revati Global Pvt. Ltd.'),
        ('company_address', 'PS Srijan Corporate Park, Sector V, Salt Lake, Kolkata, West Bengal 700091, India'),
        ('contact_email', 'info@revatiglobal.com'),
        ('contact_phone', '+91 33 4000 0000'),
        ('footer_tagline', 'Leading provider of clean energy, industrial heating, cooling, water treatment, and turnkey engineering solutions across India and global markets.')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `);
    console.log('✓ Seeded Kolkata company settings');

    // Reset sequences for all auto-increment tables so new admin creates work flawlessly
    const seqTables = [
      'categories', 'products', 'solutions', 'projects', 'applications',
      'banners', 'features', 'testimonials', 'downloads', 'faqs', 'faq_types',
      'blogs', 'blog_categories', 'pages', 'settings'
    ];
    for (const t of seqTables) {
      try {
        await client.query(`
          SELECT setval(pg_get_serial_sequence('public."${t}"', 'id'), COALESCE(MAX(id), 1) + 1, false)
          FROM public."${t}";
        `);
      } catch (seqErr) {
        // Table might not use identity sequence, ignore
      }
    }
    console.log('✓ Reset all table primary key sequences');

    await client.query('COMMIT');
    console.log('★ All database tables seeded and committed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed! Transaction rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  await seedDatabase();
  await uploadImagesToSupabase();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
