import { query } from '../config/db.js';

// Whitelist of cleanable tables with primary search columns and labels
const CLEANABLE_ENTITIES = {
    products: {
        table: 'products',
        label: 'Products & Machinery',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug', 'description', 'seo_title'],
        type: 'content'
    },
    categories: {
        table: 'categories',
        label: 'Product Categories',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug', 'description'],
        type: 'content'
    },
    blogs: {
        table: 'blogs',
        label: 'Articles & Blogs',
        titleCol: 'title',
        subCol: 'summary',
        searchCols: ['title', 'slug', 'summary', 'description'],
        type: 'content'
    },
    solutions: {
        table: 'solutions',
        label: 'Engineering Solutions',
        titleCol: 'title',
        subCol: 'summary',
        searchCols: ['title', 'slug', 'summary', 'description'],
        type: 'content'
    },
    applications: {
        table: 'applications',
        label: 'Applications & Sectors',
        titleCol: 'title',
        subCol: 'description',
        searchCols: ['title', 'slug', 'description'],
        type: 'content'
    },
    projects: {
        table: 'projects',
        label: 'Featured Projects',
        titleCol: 'title',
        subCol: 'location',
        searchCols: ['title', 'slug', 'location', 'project_type', 'description'],
        type: 'content'
    },
    downloads: {
        table: 'downloads',
        label: 'Downloads & Catalogues',
        titleCol: 'title',
        subCol: 'type',
        searchCols: ['title', 'slug', 'type', 'category'],
        type: 'media'
    },

    banners: {
        table: 'banners',
        label: 'Hero Banners',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug'],
        type: 'media'
    },
    features: {
        table: 'features',
        label: 'Core Features',
        titleCol: 'title',
        subCol: 'description',
        searchCols: ['title', 'slug', 'description', 'link'],
        type: 'media'
    },
    pages: {
        table: 'pages',
        label: 'Static Pages',
        titleCol: 'title',
        subCol: 'slug',
        searchCols: ['title', 'slug', 'summary', 'description'],
        type: 'content'
    },
    faqs: {
        table: 'faqs',
        label: 'FAQs',
        titleCol: 'question',
        subCol: 'answer',
        searchCols: ['question', 'answer', 'name', 'email'],
        type: 'content'
    },
    enquiries: {
        table: 'enquiries',
        label: 'Customer Enquiries & Leads',
        titleCol: 'name',
        subCol: 'email',
        searchCols: ['name', 'email', 'phone', 'message', 'city', 'interest'],
        type: 'leads'
    },

    subscribers: {
        table: 'subscribers',
        label: 'Newsletter Subscribers',
        titleCol: 'email',
        subCol: 'slug',
        searchCols: ['email', 'slug'],
        type: 'leads'
    },
    testimonials: {
        table: 'testimonials',
        label: 'Testimonials',
        titleCol: 'full_name',
        subCol: 'company_name',
        searchCols: ['full_name', 'company_name', 'message', 'position'],
        type: 'content'
    }
};

/**
 * GET /api/admin/cleanup/summary
 * Returns record counts for all cleanable collections
 */
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
                console.warn(`Could not count ${conf.table}:`, err.message);
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

/**
 * GET /api/admin/cleanup/search
 * Search across tables by keyword or view all records
 */
export async function searchCleanupData(req, res, next) {
    try {
        const { q = '', table = 'all', limit = 100, offset = 0, startDate, endDate } = req.query;
        const searchTerm = (q || '').trim();
        const targetTables = table === 'all' 
            ? Object.keys(CLEANABLE_ENTITIES)
            : [table].filter(t => CLEANABLE_ENTITIES[t]);

        if (targetTables.length === 0) {
            return res.status(400).json({
                result: 'error',
                message: `Invalid table filter: '${table}'`
            });
        }

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

            if (startDate && startDate.trim() !== '') {
                params.push(new Date(startDate).toISOString());
                sql += ` AND created_at >= $${params.length}`;
            }

            if (endDate && endDate.trim() !== '') {
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);
                params.push(endDateTime.toISOString());
                sql += ` AND created_at <= $${params.length}`;
            }

            // Add sorting by created_at if present
            sql += ` ORDER BY created_at DESC NULLS LAST LIMIT ${Math.min(parseInt(limit) || 100, 200)}`;

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
                        secondaryText: row[conf.subCol] || row.slug || row.description || row.message || '',
                        created_at: row.created_at || null,
                        status: row.status ?? null,
                        rawDetails: row
                    });
                });
            } catch (err) {
                console.warn(`Search error on ${conf.table}:`, err.message);
            }
        }

        // Sort combined results by created_at descending
        allResults.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
        });

        const paginated = allResults.slice(parseInt(offset) || 0, (parseInt(offset) || 0) + (parseInt(limit) || 100));

        return res.json({
            result: 'success',
            totalMatches: allResults.length,
            records: paginated
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/admin/cleanup/delete
 * Bulk delete records safely across tables
 */
export async function bulkDeleteRecords(req, res, next) {
    try {
        const { items } = req.body || {};

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                result: 'error',
                message: 'No items provided for deletion. Expected { items: [{ table: string, id: string }] }'
            });
        }

        // Group IDs by valid table name
        const tableGroups = {};
        for (const item of items) {
            const { table, id } = item || {};
            if (!table || !id) continue;

            const entity = CLEANABLE_ENTITIES[table] || Object.values(CLEANABLE_ENTITIES).find(e => e.table === table);
            if (!entity) continue;

            const tableName = entity.table;
            tableGroups[tableName] = tableGroups[tableName] || [];
            tableGroups[tableName].push(id);
        }

        let totalDeleted = 0;
        const details = {};

        for (const [tbl, ids] of Object.entries(tableGroups)) {
            if (ids.length === 0) continue;

            try {
                // If table is categories, nullify or check products
                if (tbl === 'categories') {
                    await query(`UPDATE public."products" SET category_id = NULL WHERE category_id = ANY($1::text[])`, [ids]);
                }

                const { rowCount } = await query(
                    `DELETE FROM public."${tbl}" WHERE id = ANY($1::text[])`,
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
            message: `Successfully deleted ${totalDeleted} test record(s)`,
            totalDeleted,
            breakdown: details
        });
    } catch (err) {
        next(err);
    }
}
