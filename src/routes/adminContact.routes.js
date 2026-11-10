import { Router } from 'express';
import {
    listContacts,
    getContact,
    deleteContact
} from '../controllers/adminContact.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

const router = Router();

// Protect all admin contact inquiry operations with JWT Bearer auth
router.use(adminAuthMiddleware);

router.get('/', listContacts);
router.get('/:id', getContact);
router.delete('/:id', deleteContact);

export default router;
