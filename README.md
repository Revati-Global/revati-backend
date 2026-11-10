# Revati Global - Backend API (`revati-backend`)

REST API service for Revati Global built with Node.js, Express, PostgreSQL, and Supabase Storage.

## Features
- Modular MVC architecture with Express routes and controllers.
- Supabase PostgreSQL database connectivity via connection pool.
- Secure media and document proxy for Supabase Storage (`revati-media` bucket).
- JWT authentication for admin endpoints.
- Strict CORS configuration for Revati Global domains and local development.
- Public sitemap generator.

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Configuration
Copy `.env.example` to `.env` and fill in the required variables:
```bash
cp .env.example .env
```

#### Required Environment Variables (Names Only)
- `PORT` - Port number for Express server
- `NODE_ENV` - Application environment (`development` / `production`)
- `APP_URL` - Backend public base URL
- `SITE_URL` - Public website domain URL
- `CORS_ORIGIN` - Comma-separated allowed frontend origins
- `API_KEY` - Client API key for public endpoints
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (storage operations)
- `DATABASE_URL` - PostgreSQL database connection string
- `JWT_SECRET` - Secret key for admin session tokens

### Running the Application
```bash
# Development mode with watch
npm run dev

# Production start
npm start
```
