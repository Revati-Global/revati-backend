import { supabase, BUCKET_NAME } from '../config/supabase.js';
import { config } from '../config/env.js';

export const UPLOAD_PRESETS = {
    logo: {
        folder: 'branding',
        maxBytes: 80 * 1024, // 80 KB
        allowedMimes: ['image/webp', 'image/png', 'image/svg+xml'],
        allowedExts: ['.webp', '.png', '.svg']
    },
    partner: {
        folder: 'branding',
        maxBytes: 80 * 1024,
        allowedMimes: ['image/webp', 'image/png', 'image/svg+xml'],
        allowedExts: ['.webp', '.png', '.svg']
    },
    avatar: {
        folder: 'avatars',
        maxBytes: 60 * 1024, // 60 KB
        allowedMimes: ['image/webp'],
        allowedExts: ['.webp']
    },
    thumbnail: {
        folder: 'thumbnails',
        maxBytes: 120 * 1024, // 120 KB
        allowedMimes: ['image/webp'],
        allowedExts: ['.webp']
    },
    product: {
        folder: 'products',
        maxBytes: 220 * 1024, // 220 KB
        allowedMimes: ['image/webp'],
        allowedExts: ['.webp']
    },
    project: {
        folder: 'projects',
        maxBytes: 220 * 1024,
        allowedMimes: ['image/webp'],
        allowedExts: ['.webp']
    },
    blog: {
        folder: 'blogs',
        maxBytes: 250 * 1024, // 250 KB
        allowedMimes: ['image/webp'],
        allowedExts: ['.webp']
    },
    banner: {
        folder: 'banners',
        maxBytes: 380 * 1024, // 380 KB
        allowedMimes: ['image/webp'],
        allowedExts: ['.webp']
    },
    svg: {
        folder: 'icons',
        maxBytes: 50 * 1024, // 50 KB
        allowedMimes: ['image/svg+xml'],
        allowedExts: ['.svg']
    },
    pdf: {
        folder: 'downloads',
        maxBytes: 10 * 1024 * 1024, // 10 MB
        allowedMimes: ['application/pdf'],
        allowedExts: ['.pdf']
    }
};

/**
 * Clean any full URL or storage path to pure 'folder/filename.ext'
 */
export function cleanStoragePath(pathOrUrl) {
    if (!pathOrUrl || typeof pathOrUrl !== 'string') return null;
    let clean = pathOrUrl.trim();

    // Strip http/https prefix
    if (clean.includes('/storage/v1/object/public/')) {
        clean = clean.split('/storage/v1/object/public/')[1];
    }
    if (clean.includes('/storage/v1/object/sign/')) {
        clean = clean.split('/storage/v1/object/sign/')[1].split('?')[0];
    }
    if (clean.includes(`${BUCKET_NAME}/`)) {
        clean = clean.split(`${BUCKET_NAME}/`)[1];
    }
    if (clean.startsWith('/api/media/view/')) {
        clean = clean.replace('/api/media/view/', '');
    }
    if (clean.startsWith('/api/media/document/')) {
        clean = 'downloads/' + clean.replace('/api/media/document/', '');
    }

    clean = clean.replace(/^\/+/, '');
    return clean || null;
}

/**
 * Returns public Supabase storage CDN URL for any clean storage path
 */
export function getPublicStorageUrl(pathOrUrl, fallbackFolder = 'misc') {
    if (!pathOrUrl) return '';
    if (typeof pathOrUrl !== 'string') return '';
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('/images/') || pathOrUrl.startsWith('/brand/')) {
        return pathOrUrl;
    }

    const clean = cleanStoragePath(pathOrUrl);
    if (!clean) return '';

    // If it has no folder prefix, prepend fallback folder
    const fullPath = clean.includes('/') ? clean : `${fallbackFolder}/${clean}`;

    const baseUrl = config.supabaseUrl ? config.supabaseUrl.replace(/\/$/, '') : '';
    return `${baseUrl}/storage/v1/object/public/${BUCKET_NAME}/${fullPath}`;
}

/**
 * Safely removes one or more files from Supabase Storage
 * Never throws an unhandled error; logs on failure.
 *
 * @param {string|string[]} pathsOrUrls
 * @returns {Promise<number>} count of removed files
 */
export async function removeStorageFiles(pathsOrUrls) {
    if (!pathsOrUrls) return 0;
    if (!supabase) return 0;

    const list = Array.isArray(pathsOrUrls) ? pathsOrUrls : [pathsOrUrls];
    const validPaths = [];

    for (const item of list) {
        if (!item) continue;
        if (typeof item === 'string') {
            const p = cleanStoragePath(item);
            if (p && !validPaths.includes(p)) {
                validPaths.push(p);
            }
        } else if (typeof item === 'object') {
            // Might be JSON gallery item
            const p = cleanStoragePath(item.path || item.url || item.image || item.file);
            if (p && !validPaths.includes(p)) {
                validPaths.push(p);
            }
        }
    }

    if (validPaths.length === 0) return 0;

    try {
        const { error } = await supabase.storage.from(BUCKET_NAME).remove(validPaths);
        if (error) {
            console.warn('Storage file remove warning:', error.message, validPaths);
            return 0;
        }
        return validPaths.length;
    } catch (err) {
        console.warn('Failed to remove storage files (silently handled):', err.message);
        return 0;
    }
}
