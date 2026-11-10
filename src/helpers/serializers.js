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
    const children = allCategories.filter(c => c.parent_category === category.id && c.status === 1);
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
    const children = allCategories.filter(c => c.parent_category === category.id && c.status === 1);
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
        const parent = allCategories.find(c => c.id === category.parent_category);
        if (parent) {
            if (parent.parent_category) {
                const grandParent = allCategories.find(c => c.id === parent.parent_category);
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
        title: category.title,
        slug: category.slug,
        subtitle: category.subtitle || null,
        description: category.description || null,
        sub_category_link: subCategoryLink,
        sub_category: subCategory,
        link: category.link || null,
        child_category: childCategory,
        child_category_link: childCategoryLink,
        seo_title: category.seo_title || null,
        seo_keyword: category.seo_keyword || null,
        seo_description: category.seo_description || null
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
        price: p.price ? Number(p.price).toFixed(2) : '0',
        sale_price: p.sale_price ? Number(p.sale_price).toFixed(2) : '0'
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
        image: '',
        imageUrl: item.image ? getImageUrl(item.image, 'products') : ''
    }));
}

export function serializeProductDetail(product, category = null) {
    if (!product) return {};

    return {
        slug: product.slug,
        title: product.title,
        description: product.description || null,
        category_slug: category ? category.slug : null,
        category: category ? category.title : null,
        additionals: serializeProductAdditionals(product.additionals),
        benefit_image: getImageUrl(product.benefit_image, 'products'),
        benefit_description: product.benefit_description || null,
        catalogue: getImageUrl(product.catalogue, 'products'),
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

export function serializeBlogCategoryDetail(category, productsCount = 0) {
    if (!category) return {};
    return {
        title: category.title,
        slug: category.slug,
        products: productsCount
    };
}

export function serializeServices(services) {
    if (!Array.isArray(services)) return [];
    return services.map(s => ({
        title: s.title,
        slug: s.slug,
        summary: s.summary || null,
        image: s.image ? getImageUrl(s.image, 'services') : null
    }));
}

export function serializeServiceDetail(service) {
    if (!service) return {};
    return {
        slug: service.slug,
        title: service.title,
        description: service.description || null,
        image: service.image ? getImageUrl(service.image, 'services') : null
    };
}

export function serializeIndustries(industries) {
    if (!Array.isArray(industries)) return [];
    return industries.map(item => ({
        title: item.title,
        image: item.image ? getImageUrl(item.image, 'industries') : null,
        description: item.description || null
    }));
}


export function serializeDownloads(downloads) {
    if (!Array.isArray(downloads)) return [];
    return downloads.map(item => ({
        title: item.title,
        image: item.image ? getImageUrl(item.image, 'downloads') : null
    }));
}

export function serializeReferences(references) {
    if (!Array.isArray(references)) return [];
    return references.map(item => ({
        title: item.title,
        image: item.image ? getImageUrl(item.image, 'references') : null,
        slug: item.slug
    }));
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
