import { Router } from 'express';
import {
    listFaqTypes,
    getFaqType,
    createFaqType,
    updateFaqType,
    deleteFaqType,
    listFaqs,
    getFaq,
    createFaq,
    updateFaq,
    toggleFaqStatus,
    deleteFaq
} from '../controllers/adminFaq.controller.js';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';

const router = Router();

// Protect all admin FAQ operations with JWT Bearer auth
router.use(adminAuthMiddleware);

// FAQ Types Routes
router.get('/types', listFaqTypes);
router.get('/types/:id', getFaqType);
router.post('/types', createFaqType);
router.put('/types/:id', updateFaqType);
router.delete('/types/:id', deleteFaqType);

// FAQs Routes
router.get('/', listFaqs);
router.get('/:id', getFaq);
router.post('/', createFaq);
router.put('/:id', updateFaq);
router.patch('/:id/status', toggleFaqStatus);
router.delete('/:id', deleteFaq);

export default router;
