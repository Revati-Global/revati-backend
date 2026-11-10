import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { corsOptions } from './config/cors.js';
import apiRoutes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

import { handleStatusResponse } from './utils/renderStatusPage.js';
import { generateSitemap } from './controllers/sitemap.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Trust reverse proxy (needed for accurate client IP resolution behind Render / Vercel / Nginx)
app.set('trust proxy', 1);

// Middleware - Strict CORS configuration & preflight OPTIONS handling
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static images if present
app.use('/frontend/images', express.static(path.join(__dirname, '../public/frontend/images')));

// Root server health checks
app.get(['/', '/health', '/ping'], handleStatusResponse);

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
