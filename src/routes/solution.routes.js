import { Router } from 'express';
import {
    getSolutions,
    getSolutionBySlug
} from '../controllers/solution.controller.js';

const router = Router();

router.get('/', getSolutions);
router.get('/:solution', getSolutionBySlug);

export default router;
