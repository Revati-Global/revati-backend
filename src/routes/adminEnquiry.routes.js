import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import {
    listEnquiries,
    getEnquiry,
    updateEnquiryStatus,
    deleteEnquiry,
    exportEnquiriesCsv
} from '../controllers/adminEnquiry.controller.js';

const router = Router();

router.use(adminAuth);

router.get('/export', exportEnquiriesCsv);
router.get('/', listEnquiries);
router.get('/:id', getEnquiry);
router.patch('/:id/status', updateEnquiryStatus);
router.delete('/:id', deleteEnquiry);

export default router;

