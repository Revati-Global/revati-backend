import { Router } from 'express';
import { apiKeyMiddleware } from '../middleware/apiKey.js';
import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import blogRoutes from './blog.routes.js';
import serviceRoutes from './service.routes.js';
import industryRoutes from './industry.routes.js';
import downloadRoutes from './download.routes.js';
import referenceRoutes from './reference.routes.js';
import testimonialRoutes from './testimonial.routes.js';
import faqRoutes from './faq.routes.js';
import bannerRoutes from './banner.routes.js';
import featureRoutes from './feature.routes.js';
import pageRoutes from './page.routes.js';
import contactRoutes from './contact.routes.js';
import subscriberRoutes from './subscriber.routes.js';

import adminAuthRoutes from './adminAuth.routes.js';
import adminCategoryRoutes from './adminCategory.routes.js';
import adminProductRoutes from './adminProduct.routes.js';
import adminBlogRoutes from './adminBlog.routes.js';
import adminServiceRoutes from './adminService.routes.js';
import adminIndustryRoutes from './adminIndustry.routes.js';
import adminBannerRoutes from './adminBanner.routes.js';
import adminFeatureRoutes from './adminFeature.routes.js';
import adminPageRoutes from './adminPage.routes.js';
import adminFaqRoutes from './adminFaq.routes.js';
import adminContactRoutes from './adminContact.routes.js';
import adminSubscriberRoutes from './adminSubscriber.routes.js';
import adminCleanupRoutes from './adminCleanup.routes.js';
import mediaRoutes from './media.routes.js';

import sitemapRoutes from './sitemap.routes.js';
import { handleStatusResponse } from '../utils/renderStatusPage.js';

const router = Router();

// Health check / root API status endpoint (exempt from api key)
router.get(['/', '/health', '/ping'], handleStatusResponse);

// Public XML Sitemap (exempt from api key for search engine crawlers)
router.use('/', sitemapRoutes);

// Document & Media streaming proxy (hides Supabase storage URLs)
router.use('/media', mediaRoutes);

// Admin endpoints (JWT Bearer auth)
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/categories', adminCategoryRoutes);
router.use('/admin/products', adminProductRoutes);
router.use('/admin/blogs', adminBlogRoutes);
router.use('/admin/services', adminServiceRoutes);
router.use('/admin/industries', adminIndustryRoutes);
router.use('/admin/banners', adminBannerRoutes);
router.use('/admin/features', adminFeatureRoutes);
router.use('/admin/pages', adminPageRoutes);
router.use('/admin/faqs', adminFaqRoutes);
router.use('/admin/contacts', adminContactRoutes);
router.use('/admin/subscribers', adminSubscriberRoutes);
router.use('/admin/cleanup', adminCleanupRoutes);

// Protect public frontend /api routes with ApiKeyMiddleware
router.use(apiKeyMiddleware);

// Feature routes
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/blogs', blogRoutes);
router.use('/services', serviceRoutes);
router.use('/industries', industryRoutes);
router.use('/downloads', downloadRoutes);
router.use('/references', referenceRoutes);
router.use('/testimonials', testimonialRoutes);
router.use('/faqs', faqRoutes);
router.use('/banners', bannerRoutes);
router.use('/features', featureRoutes);
router.use('/pages', pageRoutes);
router.use('/contact', contactRoutes);
router.use('/subscriber', subscriberRoutes);

export default router;
