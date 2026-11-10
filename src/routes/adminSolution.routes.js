import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
    listSolutions,
    getSolution,
    createSolution,
    updateSolution,
    deleteSolution,
    toggleSolutionStatus
} from '../controllers/adminSolution.controller.js';

const router = Router();

router.use(adminAuth);

router.get('/', listSolutions);
router.get('/:id', getSolution);
router.post('/', uploadSingle('image'), createSolution);
router.put('/:id', uploadSingle('image'), updateSolution);
router.delete('/:id', deleteSolution);
router.patch('/:id/toggle-status', toggleSolutionStatus);

export default router;
