import { Router } from 'express';
import { getPageBySlug } from '../controllers/page.controller.js';

const router = Router();

router.get('/:page', getPageBySlug);

export default router;
