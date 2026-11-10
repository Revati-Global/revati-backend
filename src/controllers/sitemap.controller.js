import { query } from '../config/db.js';
import { config } from '../config/env.js';

function escapeXml(str) {
    if (!str) return '';
    return str.toString().replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

function formatDate(date) {
    try {
        const d = date ? new Date(date) : new Date();
        if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
        return d.toISOString().split('T')[0];
    } catch {
        return new Date().toISOString().split('T')[0];
    }
}

export async function generateSitemap(req, res, next) {
    try {
        const siteUrl = (process.env.SITE_URL || config.siteUrl || 'https://revatiglobal.com').replace(/\/$/, '');

        // Static routes with default priorities and frequencies
        const staticRoutes = [
            { path: '/', priority: '1.0', changefreq: 'daily' },
            { path: '/solutions', priority: '0.9', changefreq: 'weekly' },
            { path: '/products', priority: '0.9', changefreq: 'weekly' },
            { path: '/projects', priority: '0.8', changefreq: 'weekly' },
            { path: '/applications', priority: '0.8', changefreq: 'monthly' },
            { path: '/about', priority: '0.8', changefreq: 'monthly' },
            { path: '/contact-us', priority: '0.8', changefreq: 'monthly' },
            { path: '/blogs', priority: '0.8', changefreq: 'weekly' },
            { path: '/faqs', priority: '0.7', changefreq: 'monthly' },
            { path: '/downloads', priority: '0.6', changefreq: 'monthly' },
            { path: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
            { path: '/terms-and-conditions', priority: '0.3', changefreq: 'yearly' }
        ];

        // Fetch active dynamic entries
        const [productsRes, categoriesRes, solutionsRes, blogsRes, projectsRes] = await Promise.all([
            query(`SELECT slug, updated_at, created_at FROM public."products" WHERE status = 1`),
            query(`SELECT slug, updated_at, created_at FROM public."categories" WHERE status = 1`),
            query(`SELECT slug, updated_at, created_at FROM public."solutions" WHERE status = 1`),
            query(`SELECT slug, updated_at, created_at FROM public."blogs" WHERE status = 1`),
            query(`SELECT slug, updated_at, created_at FROM public."projects" WHERE status = 1`)
        ]);

        const today = formatDate(new Date());

        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
        xml += `        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n`;
        xml += `        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">\n`;

        // 1. Static Routes
        for (const route of staticRoutes) {
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${siteUrl}${route.path}`)}</loc>\n`;
            xml += `    <lastmod>${today}</lastmod>\n`;
            xml += `    <changefreq>${route.changefreq}</changefreq>\n`;
            xml += `    <priority>${route.priority}</priority>\n`;
            xml += `  </url>\n`;
        }

        // 2. Active Products
        for (const prod of productsRes.rows) {
            if (!prod.slug) continue;
            const lastmod = formatDate(prod.updated_at || prod.created_at);
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${siteUrl}/products/${encodeURIComponent(prod.slug)}`)}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.9</priority>\n`;
            xml += `  </url>\n`;
        }

        // 3. Active Categories
        for (const cat of categoriesRes.rows) {
            if (!cat.slug) continue;
            const lastmod = formatDate(cat.updated_at || cat.created_at);
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${siteUrl}/category/${encodeURIComponent(cat.slug)}`)}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        }

        // 4. Active Solutions
        for (const s of solutionsRes.rows) {
            if (!s.slug) continue;
            const lastmod = formatDate(s.updated_at || s.created_at);
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${siteUrl}/solutions/${encodeURIComponent(s.slug)}`)}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>monthly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        }

        // 5. Active Projects
        for (const p of projectsRes.rows) {
            if (!p.slug) continue;
            const lastmod = formatDate(p.updated_at || p.created_at);
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${siteUrl}/projects/${encodeURIComponent(p.slug)}`)}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>monthly</changefreq>\n`;
            xml += `    <priority>0.8</priority>\n`;
            xml += `  </url>\n`;
        }

        // 6. Active Blogs
        for (const blog of blogsRes.rows) {
            if (!blog.slug) continue;
            const lastmod = formatDate(blog.updated_at || blog.created_at);
            xml += `  <url>\n`;
            xml += `    <loc>${escapeXml(`${siteUrl}/blogs/${encodeURIComponent(blog.slug)}`)}</loc>\n`;
            xml += `    <lastmod>${lastmod}</lastmod>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>0.7</priority>\n`;
            xml += `  </url>\n`;
        }

        xml += `</urlset>\n`;

        res.set({
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            'X-Content-Type-Options': 'nosniff'
        });

        return res.status(200).send(xml);
    } catch (err) {
        next(err);
    }
}
