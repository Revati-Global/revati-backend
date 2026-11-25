import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    listSolutions,
    getSolution,
    createSolution,
    updateSolution,
    toggleSolutionStatus,
    deleteSolution
} from '../controllers/adminSolution.controller.js';

const router = Router();

router.use(adminAuth);
router.use(authorizeRoles('super admin', 'admin', 'editor'));

router.get('/', listSolutions);
router.get('/:id', getSolution);
router.post('/', createSolution);
router.put('/:id', updateSolution);
router.patch('/:id/status', toggleSolutionStatus);
router.delete('/:id', deleteSolution);

export default router;
