import { Router } from 'express';
import {
    getApplications,
    getApplicationBySlug
} from '../controllers/application.controller.js';

const router = Router();

router.get('/', getApplications);
router.get('/:application', getApplicationBySlug);

export default router;
