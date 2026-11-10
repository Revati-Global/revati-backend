import multer from 'multer';
import path from 'path';

const storage = multer.memoryStorage();

// Allowed media MIME types and file extensions
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

// Generic upload middleware for images and general media
export const upload = multer({
    storage,
    fileFilter: mediaFileFilter,
    limits: {
        fileSize: 25 * 1024 * 1024 // 25MB limit
    }
});

// Resume upload filter with strict MIME & extension verification
const ALLOWED_RESUME_EXTS = ['.docx', '.pdf', '.doc'];
const ALLOWED_RESUME_MIMES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/octet-stream' // common fallback for word docs in some browsers
];

const resumeFileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();

    if (ALLOWED_RESUME_EXTS.includes(ext) && ALLOWED_RESUME_MIMES.includes(mime)) {
        cb(null, true);
    } else {
        const err = new Error(`Invalid resume format. Only ${ALLOWED_RESUME_EXTS.join(', ')} files are allowed.`);
        err.status = 400;
        cb(err, false);
    }
};

export const uploadResume = multer({
    storage,
    fileFilter: resumeFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
}).single('resume');
