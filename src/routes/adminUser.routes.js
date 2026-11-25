import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import {
    listUsers,
    createUser,
    updateUserRole,
    deleteUser
} from '../controllers/adminUser.controller.js';

const router = Router();

// Only Super Admin can manage users and roles
router.use(adminAuth);
router.use(authorizeRoles('super admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.patch('/:id/role', updateUserRole);
router.delete('/:id', deleteUser);

export default router;
