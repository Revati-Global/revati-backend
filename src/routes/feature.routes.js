import { Router } from 'express';
import { getFeatures } from '../controllers/feature.controller.js';

const router = Router();

router.get('/', getFeatures);

export default router;
