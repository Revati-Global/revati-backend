import dotenv from 'dotenv';
dotenv.config();

const requiredEnvVars = [
    'API_KEY',
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName] || process.env[varName].trim() === '');

if (missingEnvVars.length > 0) {
    throw new Error(
        `[FATAL CONFIG ERROR] Missing required environment variable(s) in .env: ${missingEnvVars.join(', ')}\n` +
        `Please ensure all required secrets and URLs are defined in your .env file before starting the application.`
    );
}

const port = process.env.PORT || 5000;

export const config = {
    port,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKey: process.env.API_KEY.trim(),
    supabaseUrl: process.env.SUPABASE_URL.trim(),
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY.trim(),
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
    databaseUrl: process.env.DATABASE_URL.trim(),
    jwtSecret: process.env.JWT_SECRET.trim(),
    appUrl: (process.env.APP_URL || `http://localhost:${port}`).trim().replace(/\/$/, ''),
    siteUrl: (process.env.SITE_URL || 'https://revatiglobal.com').trim().replace(/\/$/, ''),
    corsOrigins: (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
        ? (process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL)
            .replace(/["'\r\n]/g, '')
            .split(',')
            .map(s => s.trim().replace(/\/$/, ''))
            .filter(Boolean)
        : [
            'https://revatiglobal.com',
            'https://www.revatiglobal.com',
            'https://admin.revatiglobal.com',
            'http://localhost:3000',
            'http://localhost:5173'
        ]
};
