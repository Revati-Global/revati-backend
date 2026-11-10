import sharp from 'sharp';
import { randomUUID } from 'crypto';
import path from 'path';
import { supabase, BUCKET_NAME } from '../config/supabase.js';

/**
 * Compresses and converts any uploaded image to optimized WebP before saving to Supabase Storage.
 * PDFs and SVGs are stored with clean UUID filenames.
 *
 * @param {Express.Multer.File} file - Multer in-memory file
 * @param {string} folder - Target bucket folder (e.g. 'categories', 'products', 'banners', 'services', etc.)
 * @returns {Promise<string>} Uploaded unique filename
 */
export async function uploadAndOptimizeMedia(file, folder = 'misc') {
  if (!file || !file.buffer) {
    throw new Error('No valid file buffer provided for upload.');
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  const isImage = mime.startsWith('image/') && ext !== '.svg';
  const isSvg = ext === '.svg' || mime === 'image/svg+xml';
  const isPdf = ext === '.pdf' || mime === 'application/pdf';

  let uploadBuffer = file.buffer;
  let finalFilename = '';
  let contentType = file.mimetype;

  if (isImage) {
    // Compress and convert to modern WebP format
    finalFilename = `${randomUUID()}.webp`;
    contentType = 'image/webp';

    uploadBuffer = await sharp(file.buffer)
      .resize({
        width: 2000,
        height: 2000,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({
        quality: 82,
        effort: 4,
      })
      .toBuffer();
  } else if (isPdf) {
    finalFilename = `${randomUUID()}.pdf`;
    contentType = 'application/pdf';
  } else if (isSvg) {
    finalFilename = `${randomUUID()}.svg`;
    contentType = 'image/svg+xml';
  } else {
    const cleanExt = ext ? ext.replace('.', '') : 'bin';
    finalFilename = `${randomUUID()}.${cleanExt}`;
  }

  const storagePath = `${folder}/${finalFilename}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, uploadBuffer, {
      contentType,
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Failed to upload media to storage: ${uploadErr.message}`);
  }

  return finalFilename;
}
