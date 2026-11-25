import { Router } from 'express';
import { apiKeyMiddleware } from '../middleware/apiKey.js';
import { healthCheck } from '../controllers/health.controller.js';

import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import blogRoutes from './blog.routes.js';
import solutionRoutes from './solution.routes.js';
import applicationRoutes from './application.routes.js';
import projectRoutes from './project.routes.js';
import downloadRoutes from './download.routes.js';
import settingRoutes from './setting.routes.js';
import enquiryRoutes from './enquiry.routes.js';
import testimonialRoutes from './testimonial.routes.js';
import faqRoutes from './faq.routes.js';
import bannerRoutes from './banner.routes.js';
import featureRoutes from './feature.routes.js';
import pageRoutes from './page.routes.js';
import subscriberRoutes from './subscriber.routes.js';

import adminAuthRoutes from './adminAuth.routes.js';
import adminUserRoutes from './adminUser.routes.js';
import adminUploadRoutes from './adminUpload.routes.js';
import adminCategoryRoutes from './adminCategory.routes.js';
import adminProductRoutes from './adminProduct.routes.js';
import adminBlogRoutes from './adminBlog.routes.js';
import adminSolutionRoutes from './adminSolution.routes.js';
import adminApplicationRoutes from './adminApplication.routes.js';
import adminProjectRoutes from './adminProject.routes.js';
import adminDownloadRoutes from './adminDownload.routes.js';
import adminSettingRoutes from './adminSetting.routes.js';
import adminEnquiryRoutes from './adminEnquiry.routes.js';
import adminBannerRoutes from './adminBanner.routes.js';
import adminFeatureRoutes from './adminFeature.routes.js';
import adminPageRoutes from './adminPage.routes.js';
import adminFaqRoutes from './adminFaq.routes.js';
import adminSubscriberRoutes from './adminSubscriber.routes.js';
import adminCleanupRoutes from './adminCleanup.routes.js';
import cronRoutes from './cron.routes.js';
import mediaRoutes from './media.routes.js';
import sitemapRoutes from './sitemap.routes.js';

const router = Router();

// Health check / root API status endpoint (exempt from api key)
router.get(['/', '/health', '/ping'], healthCheck);

// Cron keep-alive endpoint for Supabase Free tier
router.use('/cron', cronRoutes);

// Public XML Sitemap (exempt from api key for search engine crawlers)
router.use('/', sitemapRoutes);

// Legacy Media redirect routes (redirects 301 to Supabase Storage public CDN URL)
router.use('/media', mediaRoutes);

// Admin endpoints (JWT Bearer auth & Role Enforcement)
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/users', adminUserRoutes);
router.use('/admin/uploads', adminUploadRoutes);
router.use('/admin/storage', adminUploadRoutes);
router.use('/admin/categories', adminCategoryRoutes);
router.use('/admin/products', adminProductRoutes);
router.use('/admin/blogs', adminBlogRoutes);
router.use('/admin/solutions', adminSolutionRoutes);
router.use('/admin/applications', adminApplicationRoutes);
router.use('/admin/projects', adminProjectRoutes);
router.use('/admin/downloads', adminDownloadRoutes);
router.use('/admin/settings', adminSettingRoutes);
router.use('/admin/enquiries', adminEnquiryRoutes);
router.use('/admin/banners', adminBannerRoutes);
router.use('/admin/features', adminFeatureRoutes);
router.use('/admin/pages', adminPageRoutes);
router.use('/admin/faqs', adminFaqRoutes);
router.use('/admin/subscribers', adminSubscriberRoutes);
router.use('/admin/cleanup', adminCleanupRoutes);

// Cache-control middleware for public GET endpoints (CDN caching)
const publicCacheControl = (req, res, next) => {
    if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    }
    next();
};

// Protect public frontend /api routes with ApiKeyMiddleware
router.use(apiKeyMiddleware);
router.use(publicCacheControl);

// Feature routes
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/blogs', blogRoutes);
router.use('/solutions', solutionRoutes);
router.use('/applications', applicationRoutes);
router.use('/projects', projectRoutes);
router.use('/downloads', downloadRoutes);
router.use('/settings', settingRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/faqs', faqRoutes);
router.use('/banners', bannerRoutes);
router.use('/features', featureRoutes);
router.use('/pages', pageRoutes);
router.use('/subscriber', subscriberRoutes);

export default router;
