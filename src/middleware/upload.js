import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

// Allowed media MIME types and file extensions (fallback only; primary upload is direct to Supabase Storage)
const ALLOWED_MEDIA_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.pdf'];
const ALLOWED_MEDIA_MIMES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'application/pdf'
];

const mediaFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (ALLOWED_MEDIA_EXTS.includes(ext) && (ALLOWED_MEDIA_MIMES.includes(mime) || mime.startsWith('image/'))) {
        cb(null, true);
    } else {
        const err = new Error(`Invalid file type. Allowed formats: ${ALLOWED_MEDIA_EXTS.join(', ')}`);
        err.status = 400;
        cb(err, false);
    }
};

export const upload = multer({
    storage,
    fileFilter: mediaFileFilter,
    limits: {
        fileSize: 4 * 1024 * 1024 // 4MB safe limit within Vercel body limits
    }
});

export const uploadSingle = (fieldName) => upload.single(fieldName);

export default upload;
