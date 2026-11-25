import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { uploadSingle } from '../middleware/upload.js';
import {
    listProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    toggleProjectStatus
} from '../controllers/adminProject.controller.js';

const router = Router();

router.use(adminAuth);

router.get('/', listProjects);
router.get('/:id', getProject);
router.post('/', uploadSingle('image'), createProject);
router.put('/:id', uploadSingle('image'), updateProject);
router.delete('/:id', deleteProject);
router.patch('/:id/toggle-status', toggleProjectStatus);

export default router;

