import { randomUUID } from 'crypto';
import path from 'path';
import { supabase, BUCKET_NAME } from '../config/supabase.js';
import { UPLOAD_PRESETS, getPublicStorageUrl, removeStorageFiles, cleanStoragePath } from '../helpers/storage.js';

const TOTAL_FREE_STORAGE_BYTES = 1024 * 1024 * 1024; // 1 GB Supabase Free Tier limit

/**
 * POST /api/admin/uploads/sign
 * Generates direct signed upload URL for browser upload to Supabase Storage
 */
export async function signUpload(req, res, next) {
    try {
        const { preset, filename, contentType, size } = req.body || {};

        if (!preset || !UPLOAD_PRESETS[preset]) {
            return res.status(400).json({
                result: 'error',
                message: `Invalid upload preset '${preset}'. Allowed presets: ${Object.keys(UPLOAD_PRESETS).join(', ')}`
            });
        }

        const presetConfig = UPLOAD_PRESETS[preset];

        if (!filename) {
            return res.status(400).json({ result: 'error', message: 'Original filename is required' });
        }

        const ext = path.extname(filename).toLowerCase();
        if (!presetConfig.allowedExts.includes(ext)) {
            return res.status(400).json({
                result: 'error',
                message: `Invalid file extension '${ext}' for preset '${preset}'. Allowed: ${presetConfig.allowedExts.join(', ')}`
            });
        }

        if (contentType && !presetConfig.allowedMimes.includes(contentType.toLowerCase())) {
            return res.status(400).json({
                result: 'error',
                message: `Invalid MIME type '${contentType}' for preset '${preset}'. Allowed: ${presetConfig.allowedMimes.join(', ')}`
            });
        }

        if (size && Number(size) > presetConfig.maxBytes) {
            return res.status(400).json({
                result: 'error',
                message: `File size (${Math.round(size / 1024)} KB) exceeds preset limit of ${Math.round(presetConfig.maxBytes / 1024)} KB.`
            });
        }

        if (!supabase) {
            return res.status(500).json({
                result: 'error',
                message: 'Supabase storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.'
            });
        }

        // Unique path: <folder>/<uuid>.<ext>
        const cleanExt = ext.replace(/^\./, '');
        const uniqueFilename = `${randomUUID()}.${cleanExt}`;
        const storagePath = `${presetConfig.folder}/${uniqueFilename}`;

        // Create signed upload URL
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUploadUrl(storagePath);

        if (error || !data) {
            return res.status(500).json({
                result: 'error',
                message: `Failed to create signed upload token: ${error?.message || 'Storage error'}`
            });
        }

        const publicUrl = getPublicStorageUrl(storagePath);

        return res.json({
            result: 'success',
            signedUrl: data.signedUrl,
            token: data.token,
            path: storagePath,
            publicUrl,
            preset,
            maxBytes: presetConfig.maxBytes
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/admin/uploads/confirm
 * Verifies the file was uploaded directly to Supabase and adheres to preset limits
 */
export async function confirmUpload(req, res, next) {
    try {
        const { path: uploadedPath, preset } = req.body || {};

        if (!uploadedPath) {
            return res.status(400).json({ result: 'error', message: 'Path is required for confirmation.' });
        }

        const clean = cleanStoragePath(uploadedPath);
        if (!clean) {
            return res.status(400).json({ result: 'error', message: 'Invalid storage path provided.' });
        }

        const presetConfig = preset ? UPLOAD_PRESETS[preset] : null;

        if (!supabase) {
            return res.status(500).json({ result: 'error', message: 'Supabase storage not initialized.' });
        }

        const folder = clean.split('/')[0];
        const filename = clean.split('/')[1] || clean;

        // Query file metadata from storage
        const { data: files, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(folder, {
                limit: 10,
                search: filename
            });

        if (error || !files || files.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Uploaded file not found in storage bucket.'
            });
        }

        const fileMeta = files.find(f => f.name === filename) || files[0];
        const fileSize = fileMeta?.metadata?.size || 0;

        // If preset given, verify size limits
        if (presetConfig && fileSize > presetConfig.maxBytes) {
            // Delete oversized object immediately to save quota
            await removeStorageFiles(clean);
            return res.status(400).json({
                result: 'error',
                message: `Uploaded file exceeds preset limit (${Math.round(fileSize / 1024)} KB > ${Math.round(presetConfig.maxBytes / 1024)} KB). File has been purged.`
            });
        }

        const publicUrl = getPublicStorageUrl(clean);

        return res.json({
            result: 'success',
            message: 'Upload confirmed successfully.',
            path: clean,
            publicUrl,
            size: fileSize
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/admin/storage/usage
 * Storage Monitor for Super Admins
 * Calculates storage consumption against 1 GB Supabase free tier
 */
export async function getStorageUsage(req, res, next) {
    try {
        if (!supabase) {
            return res.json({
                result: 'success',
                totalBytes: 0,
                totalFiles: 0,
                usedPercent: 0,
                limitBytes: TOTAL_FREE_STORAGE_BYTES,
                warning: false
            });
        }

        const folders = ['branding', 'avatars', 'thumbnails', 'products', 'projects', 'blogs', 'banners', 'icons', 'downloads', 'solutions', 'applications', 'categories', 'misc'];
        let totalBytes = 0;
        let totalFiles = 0;
        const breakdown = {};

        for (const folder of folders) {
            try {
                const { data, error } = await supabase.storage.from(BUCKET_NAME).list(folder, { limit: 1000 });
                if (!error && data) {
                    let folderBytes = 0;
                    let folderCount = 0;
                    for (const item of data) {
                        if (item.id || item.name) {
                            const size = item.metadata?.size || 0;
                            folderBytes += size;
                            folderCount++;
                        }
                    }
                    totalBytes += folderBytes;
                    totalFiles += folderCount;
                    breakdown[folder] = {
                        files: folderCount,
                        bytes: folderBytes,
                        kb: Math.round(folderBytes / 1024)
                    };
                }
            } catch (folderErr) {
                // ignore folder errors
            }
        }

        const usedPercent = Math.min(100, Number(((totalBytes / TOTAL_FREE_STORAGE_BYTES) * 100).toFixed(2)));
        const warning = usedPercent >= 70; // 70% threshold as requested

        return res.json({
            result: 'success',
            totalBytes,
            totalKilobytes: Math.round(totalBytes / 1024),
            totalMegabytes: Number((totalBytes / (1024 * 1024)).toFixed(2)),
            totalFiles,
            limitBytes: TOTAL_FREE_STORAGE_BYTES,
            limitMegabytes: 1024,
            usedPercent,
            warning,
            breakdown
        });
    } catch (err) {
        next(err);
    }
}
