import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Set dummy test env before imports if not already set by --env-file
process.env.API_KEY = process.env.API_KEY || 'test_api_key_12345';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'dummy_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_service_key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_testing_only';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test_cron_secret_abc';

const { isAllowedOrigin } = await import('../src/config/cors.js');
const { authorizeRoles } = await import('../src/middleware/adminAuth.js');
const { UPLOAD_PRESETS, cleanStoragePath, getPublicStorageUrl } = await import('../src/helpers/storage.js');
const { isValidEmail, isValidPhone } = await import('../src/controllers/enquiry.controller.js');
const { config } = await import('../src/config/env.js');

describe('CORS Origin Validation', () => {
    it('should permit production apex domain and subdomains', () => {
        assert.equal(isAllowedOrigin('https://revatiglobal.com'), true);
        assert.equal(isAllowedOrigin('https://www.revatiglobal.com'), true);
        assert.equal(isAllowedOrigin('https://admin.revatiglobal.com'), true);
        assert.equal(isAllowedOrigin('https://api.revatiglobal.com'), true);
    });

    it('should permit local development origins', () => {
        assert.equal(isAllowedOrigin('http://localhost:3000'), true);
        assert.equal(isAllowedOrigin('http://localhost:5173'), true);
        assert.equal(isAllowedOrigin('http://127.0.0.1:8080'), true);
    });

    it('should strictly block unauthorized domains and malicious lookalikes', () => {
        assert.equal(isAllowedOrigin('https://evil-revatiglobal.com'), false);
        assert.equal(isAllowedOrigin('https://revatiglobal.com.attacker.org'), false);
        assert.equal(isAllowedOrigin('https://phishing-site.net'), false);
    });

    it('should permit non-browser server-to-server requests without origin', () => {
        assert.equal(isAllowedOrigin(undefined), true);
        assert.equal(isAllowedOrigin(''), true);
    });
});

describe('Role-based Authorization Middleware', () => {
    it('should universally permit super admin', () => {
        const middleware = authorizeRoles('editor');
        let nextCalled = false;
        const req = { user: { role: 'super admin' } };
        const res = {};
        middleware(req, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('should permit matching role', () => {
        const middleware = authorizeRoles('editor', 'admin');
        let nextCalled = false;
        const req = { user: { role: 'editor' } };
        const res = {};
        middleware(req, res, () => { nextCalled = true; });
        assert.equal(nextCalled, true);
    });

    it('should reject non-matching role with 403', () => {
        const middleware = authorizeRoles('editor');
        let statusSet = 0;
        let responseJson = null;
        const req = { user: { role: 'sales' } };
        const res = {
            status(s) { statusSet = s; return this; },
            json(j) { responseJson = j; }
        };
        middleware(req, res, () => {});
        assert.equal(statusSet, 403);
        assert.equal(responseJson.result, 'error');
    });

    it('should reject unauthenticated request with 403', () => {
        const middleware = authorizeRoles('admin');
        let statusSet = 0;
        const req = {};
        const res = {
            status(s) { statusSet = s; return this; },
            json() {}
        };
        middleware(req, res, () => {});
        assert.equal(statusSet, 403);
    });
});

describe('Upload Presets & Storage URL Construction', () => {
    it('should have strict limits configured for all media presets', () => {
        assert.ok(UPLOAD_PRESETS.logo.maxBytes <= 80 * 1024);
        assert.ok(UPLOAD_PRESETS.avatar.maxBytes <= 60 * 1024);
        assert.ok(UPLOAD_PRESETS.thumbnail.maxBytes <= 120 * 1024);
        assert.ok(UPLOAD_PRESETS.product.maxBytes <= 220 * 1024);
        assert.ok(UPLOAD_PRESETS.project.maxBytes <= 220 * 1024);
        assert.ok(UPLOAD_PRESETS.blog.maxBytes <= 250 * 1024);
        assert.ok(UPLOAD_PRESETS.banner.maxBytes <= 380 * 1024);
        assert.ok(UPLOAD_PRESETS.pdf.maxBytes <= 10 * 1024 * 1024);
    });

    it('should clean complex storage URLs to folder/filename', () => {
        assert.equal(
            cleanStoragePath('https://dummy.supabase.co/storage/v1/object/public/revati-media/products/item.webp'),
            'products/item.webp'
        );
        assert.equal(
            cleanStoragePath('/api/media/view/solutions/heat-pump.webp'),
            'solutions/heat-pump.webp'
        );
        assert.equal(cleanStoragePath('banners/hero.webp'), 'banners/hero.webp');
    });

    it('should construct public Supabase storage CDN URLs correctly', () => {
        const url = getPublicStorageUrl('products/pump.webp', 'products');
        const expectedBase = config.supabaseUrl ? config.supabaseUrl.replace(/\/$/, '') : 'https://dummy.supabase.co';
        assert.equal(url, `${expectedBase}/storage/v1/object/public/revati-media/products/pump.webp`);
    });
});

describe('Enquiry Field Validation', () => {
    it('should validate standard Indian mobile numbers', () => {
        assert.equal(isValidPhone('9876543210'), true);
        assert.equal(isValidPhone('+91 98765 43210'), true);
        assert.equal(isValidPhone('09876543210'), true);
    });

    it('should validate international numbers with country code', () => {
        assert.equal(isValidPhone('+1 415 555 2671'), true);
        assert.equal(isValidPhone('+44 20 7946 0958'), true);
    });

    it('should reject invalid phone numbers', () => {
        assert.equal(isValidPhone('12345'), false);
        assert.equal(isValidPhone('abcdefghij'), false);
        assert.equal(isValidPhone(''), false);
    });

    it('should validate email addresses strictly', () => {
        assert.equal(isValidEmail('contact@client.com'), true);
        assert.equal(isValidEmail('engineering.lead@company.co.in'), true);
        assert.equal(isValidEmail('not-an-email'), false);
        assert.equal(isValidEmail('@missinguser.com'), false);
    });
});
