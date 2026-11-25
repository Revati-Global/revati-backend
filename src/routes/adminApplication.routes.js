import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    listApplications,
    getApplication,
    createApplication,
    updateApplication,
    toggleApplicationStatus,
    deleteApplication
} from '../controllers/adminApplication.controller.js';

const router = Router();

router.use(adminAuth);
router.use(authorizeRoles('super admin', 'admin', 'editor'));

router.get('/', listApplications);
router.get('/:id', getApplication);
router.post('/', createApplication);
router.put('/:id', updateApplication);
router.patch('/:id/status', toggleApplicationStatus);
router.delete('/:id', deleteApplication);

export default router;
