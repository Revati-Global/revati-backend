import { config } from '../config/env.js';

export function getImageUrl(image, folder = 'categories') {
    if (!image) return null;
    let filename = image;
    if (typeof image === 'string' && (image.includes('supabase.co') || image.includes('/revati-media/'))) {
        filename = image.split('/').pop();
    }
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
        if (!filename.includes('supabase.co')) return filename;
        filename = filename.split('/').pop();
    }
    const base = config.appUrl ? config.appUrl.replace(/\/$/, '') : '';
    return `${base}/api/media/view/${folder}/${filename}`;
}

export function getPdfUrl(pdf, folder = 'products') {
    if (!pdf) return '';
    let filename = pdf;
    if (typeof pdf === 'string' && (pdf.includes('supabase.co') || pdf.includes('/revati-media/'))) {
        filename = pdf.split('/').pop();
    }
    if (filename.startsWith('http://') || filename.startsWith('https://')) {
        if (!filename.includes('supabase.co')) return filename;
        filename = filename.split('/').pop();
    }
    const base = config.appUrl ? config.appUrl.replace(/\/$/, '') : '';
    return `${base}/api/media/document/${filename}`;
}

export function serializeCategoryTree(rootCategories, allCategories) {
    return rootCategories.map(cat => serializeCategoryNode(cat, allCategories));
}

export function serializeCategoryNode(category, allCategories) {
    const children = allCategories.filter(c => c.parent_category === String(category.id) && c.status === 1);
    children.sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
        slug: category.slug,
        title: category.title,
        subtitle: category.subtitle || null,
        icon: category.icon || null,
        link: category.link || null,
        pdf: category.pdf ? getPdfUrl(category.pdf, 'categories') : '',
        image: category.image ? getImageUrl(category.image, 'categories') : '',
        subCategory: children.map(sub => serializeSubCategoryNode(sub, allCategories))
    };
}

export function serializeSubCategoryNode(category, allCategories) {
    const children = allCategories.filter(c => c.parent_category === String(category.id) && c.status === 1);
    children.sort((a, b) => (a.order || 0) - (b.order || 0));

    return {
        slug: category.slug,
        title: category.title,
        subtitle: category.subtitle || null,
        link: category.link || null,
        pdf: category.pdf ? getPdfUrl(category.pdf, 'categories') : '',
        icon: category.icon || null,
        image: category.image ? getImageUrl(category.image, 'categories') : '',
        subCategory: children.map(child => ({
            slug: child.slug,
            title: child.title,
            subtitle: child.subtitle || null,
            pdf: child.pdf ? getPdfUrl(child.pdf, 'categories') : '',
            icon: child.icon || null,
            link: child.link || null,
            image: child.image ? getImageUrl(child.image, 'categories') : ''
        }))
    };
}

export function serializeCategoryDetail(category, allCategories = []) {
    if (!category) return {};

    let subCategory = null;
    let subCategoryLink = null;
    let childCategory = null;
    let childCategoryLink = null;

    if (category.parent_category) {
        const parent = allCategories.find(c => String(c.id) === String(category.parent_category));
        if (parent) {
            if (parent.parent_category) {
                const grandParent = allCategories.find(c => String(c.id) === String(parent.parent_category));
                if (grandParent) {
                    subCategory = grandParent.title;
                    subCategoryLink = grandParent.slug;
                }
                childCategory = parent.title;
                childCategoryLink = parent.slug;
            } else {
                subCategory = parent.title;
                subCategoryLink = parent.slug;
            }
        }
    }

    return {
        slug: category.slug,
        title: category.title,
        subtitle: category.subtitle || null,
        image: category.image ? getImageUrl(category.image, 'categories') : '',
        pdf: category.pdf ? getPdfUrl(category.pdf, 'categories') : '',
        description: category.description || null,
        subCategory,
        subCategoryLink,
        childCategory,
        childCategoryLink,
        seo_title: category.seo_title || null,
        seo_description: category.seo_description || null,
        seo_keyword: category.seo_keyword || null
    };
}

export function serializeProducts(products) {
    if (!Array.isArray(products)) return [];
    return products.map(p => ({
        slug: p.slug,
        title: p.title,
        summary: p.summary || null,
        type: p.type || null,
        image: p.image ? getImageUrl(p.image, 'products') : null,
        capacity: p.capacity || null,
        power: p.power || null,
        datasheet: p.datasheet ? getPdfUrl(p.datasheet, 'products') : null
    }));
}

export function serializeProductAdditionals(additionals) {
    if (!additionals) return [];
    let items = additionals;
    if (typeof items === 'string') {
        try {
            items = JSON.parse(items);
        } catch (e) {
            return [];
        }
    }
    if (!Array.isArray(items)) return [];

    return items.map(item => ({
        title: item.title || '',
        description: item.description || '',
        image: item.image ? getImageUrl(item.image, 'products') : ''
    }));
}

export function serializeProductSpecifications(specs) {
    if (!specs) return null;
    if (typeof specs === 'string') {
        try {
            return JSON.parse(specs);
        } catch (e) {
            return specs;
        }
    }
    return specs;
}

export function serializeProductDetail(product, category = null) {
    if (!product) return {};

    return {
        slug: product.slug,
        title: product.title,
        description: product.description || null,
        category_slug: category ? category.slug : null,
        category: category ? category.title : null,
        capacity: product.capacity || null,
        power: product.power || null,
        datasheet: product.datasheet ? getPdfUrl(product.datasheet, 'products') : null,
        specifications: serializeProductSpecifications(product.specifications),
        additionals: serializeProductAdditionals(product.additionals),
        benefit_image: product.benefit_image ? getImageUrl(product.benefit_image, 'products') : null,
        benefit_description: product.benefit_description || null,
        catalogue: product.catalogue ? getPdfUrl(product.catalogue, 'products') : null,
        seo_title: product.seo_title || null,
        seo_keyword: product.seo_keywords || null,
        seo_description: product.seo_description || null,
        image: product.image ? getImageUrl(product.image, 'products') : null
    };
}

export function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month}, ${year}`;
}

export function serializeBlogs(blogs, categories = []) {
    if (!Array.isArray(blogs)) return [];
    return blogs.map(blog => {
        const cat = categories.find(c => c.id === blog.category_id);
        return {
            slug: blog.slug,
            title: blog.title,
            user: 'Admin',
            category: cat ? cat.title : null,
            category_slug: cat ? cat.slug : null,
            image: blog.image ? getImageUrl(blog.image, 'blogs') : null,
            date: formatDate(blog.created_at)
        };
    });
}

export function serializeBlogDetail(blog, category = null) {
    if (!blog) return {};
    return {
        slug: blog.slug,
        title: blog.title,
        summary: blog.summary || null,
        category: category ? category.title : null,
        category_slug: category ? category.slug : null,
        description: blog.description || null,
        image: blog.image ? getImageUrl(blog.image, 'blogs') : null,
        date: formatDate(blog.created_at)
    };
}

export function serializeBlogCategories(categories, allBlogs = []) {
    if (!Array.isArray(categories)) return [];
    return categories.map(cat => {
        const blogCount = allBlogs.filter(b => b.category_id === cat.id && b.status === 1).length;
        return {
            title: cat.title,
            slug: cat.slug,
            blogs: blogCount
        };
    });
}

export function serializeBlogCategoryDetail(category, blogCount = 0) {
    if (!category) return null;
    return {
        id: category.id,
        title: category.title,
        slug: category.slug,
        blogs: blogCount
    };
}

export function serializeSolutions(solutions) {
    if (!Array.isArray(solutions)) return [];
    return solutions.map(s => ({
        title: s.title,
        slug: s.slug,
        summary: s.summary || null,
        image: s.image ? getImageUrl(s.image, 'solutions') : null
    }));
}

export function serializeSolutionDetail(solution) {
    if (!solution) return {};
    return {
        slug: solution.slug,
        title: solution.title,
        summary: solution.summary || null,
        description: solution.description || null,
        features: solution.features ? (typeof solution.features === 'string' ? JSON.parse(solution.features) : solution.features) : null,
        image: solution.image ? getImageUrl(solution.image, 'solutions') : null,
        seo_title: solution.seo_title || null,
        seo_keyword: solution.seo_keyword || null,
        seo_description: solution.seo_description || null
    };
}

export function serializeApplications(applications) {
    if (!Array.isArray(applications)) return [];
    return applications.map(item => ({
        title: item.title,
        slug: item.slug,
        image: item.image ? getImageUrl(item.image, 'applications') : null,
        description: item.description || null
    }));
}

export function serializeApplicationDetail(app) {
    if (!app) return {};
    return {
        title: app.title,
        slug: app.slug,
        image: app.image ? getImageUrl(app.image, 'applications') : null,
        description: app.description || null
    };
}

export function serializeProjects(projects) {
    if (!Array.isArray(projects)) return [];
    return projects.map(item => ({
        title: item.title,
        slug: item.slug,
        location: item.location || null,
        project_type: item.project_type || null,
        image: item.image ? getImageUrl(item.image, 'projects') : null
    }));
}

export function serializeProjectDetail(project) {
    if (!project) return {};
    let parsedImages = [];
    if (project.images) {
        try {
            const raw = typeof project.images === 'string' ? JSON.parse(project.images) : project.images;
            if (Array.isArray(raw)) {
                parsedImages = raw.map(img => getImageUrl(img, 'projects'));
            }
        } catch (e) {
            parsedImages = [];
        }
    }

    return {
        slug: project.slug,
        title: project.title,
        location: project.location || null,
        project_type: project.project_type || null,
        image: project.image ? getImageUrl(project.image, 'projects') : null,
        images: parsedImages,
        description: project.description || null,
        seo_title: project.seo_title || null,
        seo_keyword: project.seo_keyword || null,
        seo_description: project.seo_description || null
    };
}

export function serializeDownloads(downloads) {
    if (!Array.isArray(downloads)) return [];
    return downloads.map(item => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        file: item.file ? getPdfUrl(item.file, 'downloads') : null,
        type: item.type || 'brochure',
        category: item.category || null,
        image: item.image ? getImageUrl(item.image, 'downloads') : null
    }));
}

export function serializeSettings(settingsRows) {
    if (!Array.isArray(settingsRows)) return {};
    const settings = {};
    for (const row of settingsRows) {
        settings[row.key] = row.value ?? '';
    }
    return settings;
}

export function serializeTestimonials(testimonials) {
    if (!Array.isArray(testimonials)) return [];
    return testimonials.map(item => ({
        name: item.full_name,
        company: item.company_name || null,
        position: item.position || null,
        message: item.message || null,
        image: item.image ? getImageUrl(item.image, 'testimonials') : null
    }));
}

export function serializeFaqTypes(faqTypes, faqs = []) {
    if (!Array.isArray(faqTypes)) return [];
    return faqTypes.map(type => {
        const typeFaqs = faqs.filter(f => String(f.type_id) === String(type.id) && f.status === 1);
        return {
            title: type.title,
            faqs: typeFaqs.map(f => ({
                question: f.question,
                answer: f.answer
            }))
        };
    });
}

export function serializeBanners(banners) {
    if (!Array.isArray(banners)) return [];
    return banners.map(item => ({
        title: item.title,
        icon: item.icon ? getImageUrl(item.icon, 'banners') : null,
        image: item.image ? getImageUrl(item.image, 'banners') : null
    }));
}

export function serializeFeatures(features) {
    if (!Array.isArray(features)) return [];
    return features.map(item => ({
        title: item.title,
        description: item.description || null,
        link: item.link || null,
        image: item.image ? getImageUrl(item.image, 'features') : null
    }));
}

export function serializePage(page) {
    if (!page) return {};
    return {
        slug: page.slug,
        title: page.title,
        description: page.description || null,
        seo_title: page.seo_title || null,
        seo_description: page.seo_description || null,
        seo_keyword: page.seo_keyword || null,
        created_at: page.created_at,
        updated_at: page.updated_at
    };
}
