import { query } from '../config/db.js';
import { supabase, BUCKET_NAME } from '../config/supabase.js';
import { removeStorageFiles, cleanStoragePath } from '../helpers/storage.js';

// Whitelist of cleanable tables with primary search columns and labels
const CLEANABLE_ENTITIES = {
    products: {
        table: 'products',
        label: 'Products & Machinery',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug', 'description', 'seo_title'],
        type: 'content',
        fileCols: ['image', 'benefit_image', 'datasheet', 'catalogue']
    },
    categories: {
        table: 'categories',
        label: 'Product Categories',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug', 'description'],
        type: 'content',
        fileCols: ['image']
    },
    blogs: {
        table: 'blogs',
        label: 'Articles & Blogs',
        titleCol: 'title',
        subCol: 'summary',
        searchCols: ['title', 'slug', 'summary', 'description'],
        type: 'content',
        fileCols: ['image']
    },
    solutions: {
        table: 'solutions',
        label: 'Engineering Solutions',
        titleCol: 'title',
        subCol: 'summary',
        searchCols: ['title', 'slug', 'summary', 'description'],
        type: 'content',
        fileCols: ['image']
    },
    applications: {
        table: 'applications',
        label: 'Applications & Sectors',
        titleCol: 'title',
        subCol: 'description',
        searchCols: ['title', 'slug', 'description'],
        type: 'content',
        fileCols: ['image']
    },
    projects: {
        table: 'projects',
        label: 'Featured Projects',
        titleCol: 'title',
        subCol: 'location',
        searchCols: ['title', 'slug', 'location', 'project_type', 'description'],
        type: 'content',
        fileCols: ['image', 'images']
    },
    downloads: {
        table: 'downloads',
        label: 'Downloads & Catalogues',
        titleCol: 'title',
        subCol: 'type',
        searchCols: ['title', 'slug', 'type', 'category'],
        type: 'media',
        fileCols: ['file', 'image']
    },
    banners: {
        table: 'banners',
        label: 'Hero Banners',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug'],
        type: 'media',
        fileCols: ['image', 'icon']
    },
    features: {
        table: 'features',
        label: 'Core Features',
        titleCol: 'title',
        subCol: 'description',
        searchCols: ['title', 'slug', 'description', 'link'],
        type: 'media',
        fileCols: ['image']
    },
    pages: {
        table: 'pages',
        label: 'Static Pages',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug', 'summary', 'description'],
        type: 'content',
        fileCols: ['image']
    },
    faqs: {
        table: 'faqs',
        label: 'FAQs',
        titleCol: 'question',
        subCol: 'answer',
        searchCols: ['question', 'answer', 'name', 'email'],
        type: 'content',
        fileCols: []
    },
    enquiries: {
        table: 'enquiries',
        label: 'Customer Enquiries & Leads',
        titleCol: 'name',
        subCol: 'email',
        searchCols: ['name', 'email', 'phone', 'message', 'city', 'interest'],
        type: 'leads',
        fileCols: []
    },
    subscribers: {
        table: 'subscribers',
        label: 'Newsletter Subscribers',
        titleCol: 'email',
        subCol: 'slug',
        searchCols: ['email', 'slug'],
        type: 'leads',
        fileCols: []
    },
    testimonials: {
        table: 'testimonials',
        label: 'Testimonials',
        titleCol: 'full_name',
        subCol: 'company_name',
        searchCols: ['full_name', 'company_name', 'message', 'position'],
        type: 'content',
        fileCols: ['image']
    }
};

export async function getCleanupSummary(req, res, next) {
    try {
        const counts = {};
        let totalRecords = 0;

        for (const [key, conf] of Object.entries(CLEANABLE_ENTITIES)) {
            try {
                const { rows } = await query(`SELECT COUNT(*)::int AS cnt FROM public."${conf.table}"`);
                const cnt = rows[0]?.cnt || 0;
                counts[key] = {
                    key,
                    table: conf.table,
                    label: conf.label,
                    type: conf.type,
                    count: cnt
                };
                totalRecords += cnt;
            } catch (err) {
                counts[key] = {
                    key,
                    table: conf.table,
                    label: conf.label,
                    type: conf.type,
                    count: 0
                };
            }
        }

        return res.json({
            result: 'success',
            totalRecords,
            summary: counts
        });
    } catch (err) {
        next(err);
    }
}

export async function searchCleanupData(req, res, next) {
    try {
        const { q = '', table = 'all', limit = 100, offset = 0 } = req.query;
        const searchTerm = (q || '').trim();
        const targetTables = table === 'all'
            ? Object.keys(CLEANABLE_ENTITIES)
            : [table].filter(t => CLEANABLE_ENTITIES[t]);

        const allResults = [];

        for (const key of targetTables) {
            const conf = CLEANABLE_ENTITIES[key];
            let sql = `SELECT * FROM public."${conf.table}" WHERE 1=1`;
            let params = [];

            if (searchTerm) {
                const conditions = conf.searchCols.map((col) => `CAST("${col}" AS TEXT) ILIKE $${params.length + 1}`);
                params.push(`%${searchTerm}%`);
                sql += ` AND (${conditions.join(' OR ')})`;
            }

            sql += ` ORDER BY created_at DESC NULLS LAST LIMIT ${Math.min(parseInt(limit, 10) || 100, 200)}`;

            try {
                const { rows } = await query(sql, params);
                rows.forEach(row => {
                    allResults.push({
                        id: String(row.id),
                        tableKey: key,
                        tableName: conf.table,
                        tableLabel: conf.label,
                        type: conf.type,
                        primaryText: row[conf.titleCol] || row.name || row.email || row.title || 'Untitled',
                        secondaryText: row[conf.subCol] || row.slug || row.description || '',
                        created_at: row.created_at || null,
                        status: row.status ?? null,
                        rawDetails: row
                    });
                });
            } catch (err) {
                console.warn(`Search error on ${conf.table}:`, err.message);
            }
        }

        return res.json({
            result: 'success',
            totalMatches: allResults.length,
            records: allResults.slice(parseInt(offset, 10) || 0, (parseInt(offset, 10) || 0) + (parseInt(limit, 10) || 100))
        });
    } catch (err) {
        next(err);
    }
}

export async function bulkDeleteRecords(req, res, next) {
    try {
        const { items } = req.body || {};

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                result: 'error',
                message: 'No items provided for deletion.'
            });
        }

        const tableGroups = {};
        for (const item of items) {
            const { table, id } = item || {};
            if (!table || !id) continue;
            const entity = CLEANABLE_ENTITIES[table] || Object.values(CLEANABLE_ENTITIES).find(e => e.table === table);
            if (!entity) continue;
            tableGroups[entity.table] = tableGroups[entity.table] || [];
            tableGroups[entity.table].push(id);
        }

        let totalDeleted = 0;
        let filesRemovedCount = 0;
        const details = {};

        for (const [tbl, ids] of Object.entries(tableGroups)) {
            if (ids.length === 0) continue;

            const conf = Object.values(CLEANABLE_ENTITIES).find(c => c.table === tbl);

            // Fetch file columns before deleting rows to clean up Supabase storage
            if (conf && conf.fileCols && conf.fileCols.length > 0) {
                try {
                    const fileSql = `SELECT ${conf.fileCols.map(c => `"${c}"`).join(', ')} FROM public."${tbl}" WHERE id = ANY($1::bigint[])`;
                    const { rows: filesRows } = await query(fileSql, [ids]);
                    const pathsToPurge = [];
                    for (const r of filesRows) {
                        for (const col of conf.fileCols) {
                            const val = r[col];
                            if (!val) continue;
                            if (typeof val === 'string') pathsToPurge.push(val);
                            else if (Array.isArray(val)) pathsToPurge.push(...val);
                        }
                    }
                    if (pathsToPurge.length > 0) {
                        const cnt = await removeStorageFiles(pathsToPurge);
                        filesRemovedCount += cnt;
                    }
                } catch (fileErr) {
                    console.warn(`File cleanup error on ${tbl}:`, fileErr.message);
                }
            }

            try {
                if (tbl === 'categories') {
                    await query(`UPDATE public."products" SET category_id = NULL WHERE category_id = ANY($1::bigint[])`, [ids]);
                }

                const { rowCount } = await query(
                    `DELETE FROM public."${tbl}" WHERE id = ANY($1::bigint[])`,
                    [ids]
                );
                totalDeleted += (rowCount || 0);
                details[tbl] = rowCount || 0;
            } catch (err) {
                console.error(`Failed to delete from ${tbl}:`, err.message);
                details[tbl] = `Error: ${err.message}`;
            }
        }

        return res.json({
            result: 'success',
            message: `Successfully deleted ${totalDeleted} record(s) and pruned ${filesRemovedCount} associated storage file(s).`,
            totalDeleted,
            filesRemovedCount,
            breakdown: details
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Scan for orphaned files in Supabase Storage (files that exist in bucket but are not referenced in DB)
 */
export async function scanOrphanFiles(req, res, next) {
    try {
        if (!supabase) {
            return res.status(500).json({ result: 'error', message: 'Storage not configured' });
        }

        // 1. Collect all known file paths referenced across all DB tables
        const dbReferences = new Set();
        for (const conf of Object.values(CLEANABLE_ENTITIES)) {
            if (!conf.fileCols || conf.fileCols.length === 0) continue;
            try {
                const { rows } = await query(`SELECT ${conf.fileCols.map(c => `"${c}"`).join(', ')} FROM public."${conf.table}"`);
                for (const row of rows) {
                    for (const col of conf.fileCols) {
                        const val = row[col];
                        if (!val) continue;
                        if (typeof val === 'string') {
                            const p = cleanStoragePath(val);
                            if (p) dbReferences.add(p.toLowerCase());
                        } else if (Array.isArray(val)) {
                            for (const item of val) {
                                const p = cleanStoragePath(typeof item === 'string' ? item : item?.url || item?.image);
                                if (p) dbReferences.add(p.toLowerCase());
                            }
                        }
                    }
                }
            } catch { }
        }

        // Also check settings table for logo
        try {
            const { rows } = await query(`SELECT value FROM public.settings WHERE key = 'logo'`);
            if (rows[0]?.value) {
                const p = cleanStoragePath(rows[0].value);
                if (p) dbReferences.add(p.toLowerCase());
            }
        } catch { }

        // 2. Scan bucket folders
        const folders = ['branding', 'avatars', 'thumbnails', 'products', 'projects', 'blogs', 'banners', 'icons', 'downloads', 'solutions', 'applications', 'categories', 'misc'];
        const orphanFiles = [];
        let totalScanned = 0;

        for (const folder of folders) {
            try {
                const { data } = await supabase.storage.from(BUCKET_NAME).list(folder, { limit: 1000 });
                if (data && Array.isArray(data)) {
                    for (const f of data) {
                        if (!f.name || f.name === '.emptyFolderPlaceholder') continue;
                        totalScanned++;
                        const fullPath = `${folder}/${f.name}`;
                        if (!dbReferences.has(fullPath.toLowerCase())) {
                            orphanFiles.push({
                                path: fullPath,
                                folder,
                                name: f.name,
                                size: f.metadata?.size || 0,
                                createdAt: f.created_at || null
                            });
                        }
                    }
                }
            } catch { }
        }

        return res.json({
            result: 'success',
            totalScanned,
            orphanCount: orphanFiles.length,
            orphans: orphanFiles
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Purge specified or all orphan files
 */
export async function purgeOrphanFiles(req, res, next) {
    try {
        const { paths } = req.body || {};
        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return res.status(400).json({ result: 'error', message: 'Array of paths to purge is required' });
        }

        const count = await removeStorageFiles(paths);
        return res.json({
            result: 'success',
            message: `Purged ${count} orphaned file(s) from Supabase Storage.`,
            count
        });
    } catch (err) {
        next(err);
    }
}
