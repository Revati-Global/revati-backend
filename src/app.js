import express from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthCheck } from './controllers/health.controller.js';
import { generateSitemap } from './controllers/sitemap.controller.js';

const app = express();

// Trust reverse proxy (needed for accurate client IP resolution behind Vercel / Nginx)
app.set('trust proxy', 1);

// Middleware - Strict CORS configuration & preflight OPTIONS handling
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// JSON & URL-encoded body limits (max 1MB for serverless safety)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Root server health checks
app.get(['/', '/health', '/ping'], healthCheck);

// Root sitemap.xml endpoint (search engines)
app.get(['/sitemap.xml', '/sitemap'], generateSitemap);

// API Routes
app.use('/api', apiRoutes);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        result: 'error',
        message: `Cannot ${req.method} ${req.originalUrl}`
    });
});

// Global Error Handler
app.use(errorHandler);

export default app;
