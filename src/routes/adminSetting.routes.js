import { Router } from 'express';
import { adminAuth, authorizeRoles } from '../middleware/adminAuth.js';
import { listSettings, updateSettings } from '../controllers/adminSetting.controller.js';

const router = Router();

router.use(adminAuth);
router.use(authorizeRoles('super admin', 'admin'));

router.get('/', listSettings);
router.post('/', updateSettings);
router.put('/', updateSettings);

export default router;
