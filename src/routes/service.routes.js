import { Router } from 'express';
import {
    getServices,
    getServiceBySlug
} from '../controllers/service.controller.js';

const router = Router();

router.get('/', getServices);
router.get('/:service', getServiceBySlug);

export default router;
