import { getPublicStorageUrl } from './storage.js';

export function getImageUrl(image, folder = 'categories') {
    if (!image) return null;
    if (typeof image !== 'string') return null;
    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/images/') || image.startsWith('/brand/')) {
        return image;
    }
    return getPublicStorageUrl(image, folder);
}

export function getPdfUrl(pdf, folder = 'downloads') {
    if (!pdf) return '';
    return getPublicStorageUrl(pdf, folder);
}

export function serializeCategoryTree(rootCategories, allCategories) {
    return (rootCategories || []).map(cat => serializeCategoryNode(cat, allCategories));
}

export function serializeCategoryDetail(category, allCategories = []) {
    return serializeCategoryNode(category, allCategories);
}

export function serializeCategoryNode(category, allCategories = []) {
    if (!category) return null;
    const children = (allCategories || []).filter(c => {
        const pId = c.parent_id !== undefined && c.parent_id !== null ? String(c.parent_id) : (c.parent_category ? String(c.parent_category) : null);
        return pId === String(category.id) && c.status === 1;
    });
    children.sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
        id: category.id,
        slug: category.slug,
        title: category.title,
        parent_id: category.parent_id ?? null,
        description: category.description || null,
        image: category.image ? getImageUrl(category.image, 'categories') : null,
        status: category.status,
        order: category.order || 0,
        navigation_status: category.navigation_status || 0,
        home_status: category.home_status || 0,
        seo_title: category.seo_title || null,
        seo_keyword: category.seo_keyword || null,
        seo_description: category.seo_description || null,
        subCategories: children.map(sub => serializeCategoryNode(sub, allCategories))
    };
}

export function serializeProduct(product, category = null) {
    if (!product) return null;
    return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        description: product.description || '',
        category_id: product.category_id || null,
        category: category ? {
            id: category.id,
            title: category.title,
            slug: category.slug
        } : null,
        feature_and_benefit: product.feature_and_benefit || null,
        benefit_description: product.benefit_description || null,
        benefit_image: product.benefit_image ? getImageUrl(product.benefit_image, 'products') : null,
        specifications: product.specifications || null,
        additionals: product.additionals || null,
        capacity: product.capacity || null,
        power: product.power || null,
        datasheet: product.datasheet ? getPdfUrl(product.datasheet, 'downloads') : null,
        catalogue: product.catalogue ? getPdfUrl(product.catalogue, 'downloads') : null,
        image: product.image ? getImageUrl(product.image, 'products') : null,
        status: product.status,
        order: product.order || 0,
        seo_title: product.seo_title || null,
        seo_keyword: product.seo_keyword || product.seo_keywords || null,
        seo_description: product.seo_description || null,
        created_at: product.created_at,
        updated_at: product.updated_at
    };
}

export function serializeProducts(products) {
    if (!Array.isArray(products)) return [];
    return products.map(p => serializeProduct(p));
}

export function serializeProductDetail(product, category = null) {
    return serializeProduct(product, category);
}

export function serializeSolution(solution) {
    if (!solution) return null;
    return {
        id: solution.id,
        slug: solution.slug,
        title: solution.title,
        summary: solution.summary || null,
        description: solution.description || null,
        features: solution.features || null,
        image: solution.image ? getImageUrl(solution.image, 'solutions') : null,
        status: solution.status,
        order: solution.order || 0,
        seo_title: solution.seo_title || null,
        seo_keyword: solution.seo_keyword || null,
        seo_description: solution.seo_description || null,
        created_at: solution.created_at
    };
}

export function serializeSolutions(solutions) {
    if (!Array.isArray(solutions)) return [];
    return solutions.map(s => serializeSolution(s));
}

export function serializeSolutionDetail(solution) {
    return serializeSolution(solution);
}

export function serializeProject(project) {
    if (!project) return null;
    return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        client: project.client || null,
        location: project.location || null,
        capacity: project.capacity || null,
        year: project.year || null,
        project_type: project.project_type || null,
        description: project.description || null,
        summary: project.summary || null,
        image: project.image ? getImageUrl(project.image, 'projects') : null,
        images: Array.isArray(project.images) 
            ? project.images.map(img => typeof img === 'string' ? getImageUrl(img, 'projects') : img)
            : null,
        status: project.status,
        order: project.order || 0,
        seo_title: project.seo_title || null,
        seo_keyword: project.seo_keyword || null,
        seo_description: project.seo_description || null,
        created_at: project.created_at
    };
}

export function serializeProjects(projects) {
    if (!Array.isArray(projects)) return [];
    return projects.map(p => serializeProject(p));
}

export function serializeProjectDetail(project) {
    return serializeProject(project);
}

export function serializeApplication(application) {
    if (!application) return null;
    return {
        id: application.id,
        slug: application.slug,
        title: application.title,
        summary: application.summary || null,
        description: application.description || null,
        image: application.image ? getImageUrl(application.image, 'applications') : null,
        status: application.status,
        order: application.order || 0,
        seo_title: application.seo_title || null,
        seo_keyword: application.seo_keyword || null,
        seo_description: application.seo_description || null,
        created_at: application.created_at
    };
}

export function serializeApplications(applications) {
    if (!Array.isArray(applications)) return [];
    return applications.map(a => serializeApplication(a));
}

export function serializeApplicationDetail(application) {
    return serializeApplication(application);
}

export function serializeDownload(download) {
    if (!download) return null;
    return {
        id: download.id,
        slug: download.slug,
        title: download.title,
        type: download.type || 'brochure',
        category: download.category || null,
        description: download.description || null,
        file: download.file ? getPdfUrl(download.file, 'downloads') : null,
        file_size: download.file_size || null,
        image: download.image ? getImageUrl(download.image, 'downloads') : null,
        status: download.status,
        order: download.order || 0,
        created_at: download.created_at
    };
}

export function serializeDownloads(downloads) {
    if (!Array.isArray(downloads)) return [];
    return downloads.map(d => serializeDownload(d));
}

export function serializeFeatures(features) {
    if (!Array.isArray(features)) return [];
    return features.map(f => ({
        id: f.id,
        title: f.title,
        slug: f.slug,
        icon: f.icon || null,
        description: f.description || null,
        order: f.order || 0,
        status: f.status
    }));
}

export function serializeFaqTypes(types) {
    if (!Array.isArray(types)) return [];
    return types.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        faqs: Array.isArray(t.faqs) ? t.faqs : []
    }));
}

export function serializePage(page) {
    if (!page) return null;
    return {
        id: page.id,
        slug: page.slug,
        title: page.title,
        content: page.content || '',
        status: page.status,
        seo_title: page.seo_title || null,
        seo_keyword: page.seo_keyword || null,
        seo_description: page.seo_description || null
    };
}

export function serializeSettings(rows) {
    const settings = {};
    if (Array.isArray(rows)) {
        rows.forEach(r => {
            try {
                settings[r.key] = JSON.parse(r.value);
            } catch {
                settings[r.key] = r.value;
            }
        });
    }
    return settings;
}

export function serializeTestimonials(testimonials) {
    if (!Array.isArray(testimonials)) return [];
    return testimonials.map(t => ({
        id: t.id,
        name: t.name,
        company: t.company || null,
        designation: t.designation || null,
        content: t.content || '',
        avatar: t.avatar ? getImageUrl(t.avatar, 'avatars') : null,
        rating: t.rating || 5,
        status: t.status
    }));
}

export function serializeBlogs(blogs) {
    if (!Array.isArray(blogs)) return [];
    return blogs.map(b => ({
        id: b.id,
        title: b.title,
        slug: b.slug,
        summary: b.summary || null,
        content: b.content || null,
        image: b.image ? getImageUrl(b.image, 'blogs') : null,
        author: b.author || null,
        published_at: b.published_at || b.created_at,
        status: b.status
    }));
}

export function serializeBlogDetail(blog) {
    if (!blog) return null;
    return {
        id: blog.id,
        title: blog.title,
        slug: blog.slug,
        summary: blog.summary || null,
        content: blog.content || null,
        image: blog.image ? getImageUrl(blog.image, 'blogs') : null,
        author: blog.author || null,
        published_at: blog.published_at || blog.created_at,
        status: blog.status,
        seo_title: blog.seo_title || null,
        seo_keyword: blog.seo_keyword || null,
        seo_description: blog.seo_description || null
    };
}

export function serializeBlogCategory(cat) {
    if (!cat) return null;
    return {
        id: cat.id,
        title: cat.title,
        slug: cat.slug,
        status: cat.status,
        order: cat.order || 0
    };
}

export function serializeBlogCategories(cats) {
    if (!Array.isArray(cats)) return [];
    return cats.map(c => serializeBlogCategory(c));
}

export function serializeBlogCategoryDetail(cat) {
    return serializeBlogCategory(cat);
}

export function serializeBanners(banners) {
    if (!Array.isArray(banners)) return [];
    return banners.map(b => ({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || null,
        cta_text: b.cta_text || null,
        cta_link: b.cta_link || null,
        image: b.image ? getImageUrl(b.image, 'banners') : null,
        status: b.status,
        order: b.order || 0
    }));
}
