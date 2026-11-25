import { query } from '../config/db.js';
import { removeStorageFiles, cleanStoragePath } from '../helpers/storage.js';

export async function listSettings(req, res, next) {
    try {
        const { rows } = await query(`SELECT * FROM public.settings ORDER BY "group" ASC, "key" ASC`);
        
        // Return both array and key-value map for convenience
        const settingsMap = {};
        for (const row of rows) {
            settingsMap[row.key] = row.value;
        }

        return res.json({
            result: 'success',
            settings: rows,
            settingsMap
        });
    } catch (err) {
        next(err);
    }
}

export async function updateSettings(req, res, next) {
    try {
        const { settings } = req.body || {};

        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                result: 'error',
                message: 'Settings object is required { [key: string]: value }'
            });
        }

        // Check if logo is being updated
        if (settings.logo) {
            const { rows: oldLogo } = await query(`SELECT value FROM public.settings WHERE key = 'logo' LIMIT 1`);
            const prevLogo = oldLogo[0]?.value;
            const newLogo = cleanStoragePath(settings.logo);
            if (prevLogo && newLogo && prevLogo !== newLogo) {
                removeStorageFiles(prevLogo).catch(() => {});
            }
            settings.logo = newLogo;
        }

        for (const [key, val] of Object.entries(settings)) {
            const valueStr = val !== null && val !== undefined ? String(val) : '';
            await query(
                `INSERT INTO public.settings ("key", "value", "updated_at")
                 VALUES ($1, $2, NOW())
                 ON CONFLICT ("key") DO UPDATE
                   SET "value" = EXCLUDED."value",
                       "updated_at" = NOW();`,
                [key, valueStr]
            );
        }

        const { rows: updated } = await query(`SELECT * FROM public.settings ORDER BY "group" ASC, "key" ASC`);

        return res.json({
            result: 'success',
            message: 'Settings updated successfully',
            settings: updated
        });
    } catch (err) {
        next(err);
    }
}
