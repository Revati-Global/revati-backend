# Revati Global - Backend API (`revati-backend`)

Production Node.js / Express REST API service for Revati Global, optimized for Vercel Serverless (`bom1` region) and Supabase PostgreSQL with direct client storage uploads.

## Key Features
- **Vercel Serverless Ready:** Clean app export in `api/index.js` with `bom1` (Mumbai) region routing.
- **Database Architecture:** 23 PostgreSQL tables with Row Level Security (RLS), Supabase transaction pooler (port 6543, `max: 1` per serverless instance).
- **Direct Signed Uploads:** Browser uploads directly to Supabase Storage via signed tokens, bypassing Vercel 4.5 MB body limit and eliminating serverless memory bloat.
- **Egress Protection:** Direct Supabase CDN public URLs; legacy media routes redirect with HTTP 301; automated orphan cleanup on asset update/deletion.
- **Strict RBAC:** Role-based access control with live DB role checks: `super admin`, `admin`, `editor`, and `sales`.
- **Atomic Rate Limiter:** PostgreSQL-backed atomic rate limiter on `rate_limits` table.
- **Transactional Email:** Resend HTTP integration for instant company alerts and customer confirmation emails.
- **Form Spam Protection:** Honeypot verification, submission timing checks, and optional Cloudflare Turnstile token validation.
- **Unit Test Suite:** 15 automated Node.js unit tests (`npm test`) covering CORS, RBAC, upload presets, URL sanitizers, and RFQ validators.

## Getting Started

### Installation & Testing
```bash
npm install
npm test
```

### Initial Admin Setup
```bash
node scripts/create-admin.js
```

### Development Server
```bash
npm run dev
```
