import { getPublicStorageUrl } from './storage.js';

export function getImageUrl(image, folder = 'categories') {
    if (!image) return null;
    return getPublicStorageUrl(image, folder);
}

export function getPdfUrl(pdf, folder = 'downloads') {
    if (!pdf) return '';
    return getPublicStorageUrl(pdf, folder);
}

export function serializeCategoryTree(rootCategories, allCategories) {
    return rootCategories.map(cat => serializeCategoryNode(cat, allCategories));
}

export function serializeCategoryNode(category, allCategories) {
    const children = allCategories.filter(c => {
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

export function serializeProject(project) {
    if (!project) return null;
    return {
        id: project.id,
        slug: project.slug,
        title: project.title,
        location: project.location || null,
        project_type: project.project_type || null,
        description: project.description || null,
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

export function serializeApplication(application) {
    if (!application) return null;
    return {
        id: application.id,
        slug: application.slug,
        title: application.title,
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

export function serializeDownload(download) {
    if (!download) return null;
    return {
        id: download.id,
        slug: download.slug,
        title: download.title,
        type: download.type || 'brochure',
        category: download.category || null,
        file: download.file ? getPdfUrl(download.file, 'downloads') : null,
        image: download.image ? getImageUrl(download.image, 'downloads') : null,
        status: download.status,
        order: download.order || 0,
        created_at: download.created_at
    };
}
