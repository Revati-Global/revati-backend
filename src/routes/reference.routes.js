import { Router } from 'express';
import { getReferences } from '../controllers/reference.controller.js';

const router = Router();

router.get('/', getReferences);

export default router;
