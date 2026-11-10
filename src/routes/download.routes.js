import { Router } from 'express';
import { getDownloads } from '../controllers/download.controller.js';

const router = Router();

router.get('/', getDownloads);

export default router;
