import { Router } from 'express';
import { generateSitemap } from '../controllers/sitemap.controller.js';

const router = Router();

router.get(['/sitemap.xml', '/sitemap'], generateSitemap);

export default router;
