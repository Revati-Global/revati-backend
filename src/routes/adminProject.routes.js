import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    listProjects,
    getProject,
    createProject,
    updateProject,
    toggleProjectStatus,
    deleteProject
} from '../controllers/adminProject.controller.js';

const router = Router();

router.use(adminAuth);
router.use(authorizeRoles('super admin', 'admin', 'editor'));

router.get('/', listProjects);
router.get('/:id', getProject);
router.post('/', createProject);
router.put('/:id', updateProject);
router.patch('/:id/status', toggleProjectStatus);
router.delete('/:id', deleteProject);

export default router;
