import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import { listSettings, updateSettings } from '../controllers/adminSetting.controller.js';

const router = Router();

router.use(adminAuth);

router.get('/', listSettings);
router.put('/', updateSettings);
router.post('/', updateSettings);

export default router;
