import { Router } from 'express';
import { getPublicStorageUrl, cleanStoragePath } from '../helpers/storage.js';

const router = Router();

/**
 * Legacy URL compatibility redirector:
 * Instead of proxy streaming or multi-folder sequential downloads from Supabase,
 * this endpoint sends an immediate 301 Permanent Redirect to the public Supabase storage CDN URL.
 * Supabase free egress is preserved and Vercel serverless function time is virtually 0ms.
 */

router.get('/view/:folder/:filename', (req, res) => {
    const { folder, filename } = req.params;
    if (!filename) {
        return res.status(400).send('Filename is required');
    }
    const publicUrl = getPublicStorageUrl(`${folder}/${filename}`, folder);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.redirect(301, publicUrl);
});

router.get('/document/:filename', (req, res) => {
    const { filename } = req.params;
    const folder = req.query.folder || 'downloads';
    if (!filename) {
        return res.status(400).send('Filename is required');
    }
    const publicUrl = getPublicStorageUrl(`${folder}/${filename}`, folder);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.redirect(301, publicUrl);
});

export default router;
