import { Router } from 'express';
import { supabase, BUCKET_NAME } from '../config/supabase.js';

const router = Router();

const FOLDERS_TO_SEARCH = [
  'categories',
  'products',
  'banners',
  'solutions',
  'projects',
  'applications',
  'blogs',
  'features',
  'pages',
  'downloads'
];

const MIME_MAP = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  gif: 'image/gif',
  pdf: 'application/pdf'
};

function getMime(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return MIME_MAP[ext] || 'application/octet-stream';
}

/**
 * Universal safe document/media streamer
 * Hides Supabase bucket URLs completely from the client
 * URL: /api/media/document/:filename
 */
router.get('/document/:filename', async (req, res) => {
  const { filename } = req.params;
  const targetFolder = req.query.folder;

  if (!filename) {
    return res.status(400).send('Filename is required');
  }

  const searchList = targetFolder ? [targetFolder, ...FOLDERS_TO_SEARCH] : FOLDERS_TO_SEARCH;

  for (const folder of searchList) {
    const fullPath = `${folder}/${filename}`;
    try {
      const { data, error } = await supabase.storage.from(BUCKET_NAME).download(fullPath);
      if (!error && data) {
        const buffer = Buffer.from(await data.arrayBuffer());
        res.setHeader('Content-Type', getMime(filename));
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.send(buffer);
      }
    } catch (err) {
      // continue searching other folders
    }
  }

  // Also try root level
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filename);
    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader('Content-Type', getMime(filename));
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    }
  } catch (err) {
    // ignore
  }

  return res.status(404).send(`Document "${filename}" was not found in media storage.`);
});

/**
 * Direct folder media view
 * URL: /api/media/view/:folder/:filename
 */
router.get('/view/:folder/:filename', async (req, res) => {
  const { folder, filename } = req.params;
  const fullPath = `${folder}/${filename}`;

  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).download(fullPath);
    if (error || !data) {
      // Fallback search other folders
      return res.redirect(`/api/media/document/${filename}`);
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader('Content-Type', getMime(filename));
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.send(buffer);
  } catch (err) {
    return res.redirect(`/api/media/document/${filename}`);
  }
});

export default router;
