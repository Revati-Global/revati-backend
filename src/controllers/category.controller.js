import { query } from '../config/db.js';
import {
    serializeCategoryTree,
    serializeCategoryDetail,
    serializeProducts
} from '../helpers/serializers.js';

export async function getCategories(req, res, next) {
    try {
        const { rows: allCategories } = await query(
            `SELECT * FROM public."categories" WHERE status = 1 ORDER BY "order" ASC, "id" ASC`
        );

        const rootCategories = allCategories.filter(c => c.parent_category === null);
        const serialized = serializeCategoryTree(rootCategories, allCategories);

        return res.json({
            result: 'success',
            categories: serialized
        });
    } catch (err) {
        next(err);
    }
}

export async function getCategoryBySlug(req, res, next) {
    try {
        const { category: slug } = req.params;

        const { rows: allCategories } = await query(
            `SELECT * FROM public."categories" WHERE status = 1 ORDER BY "order" ASC, "id" ASC`
        );

        const category = allCategories.find(c => c.slug === slug);
        if (!category) {
            return res.status(404).json({
                result: 'error',
                message: 'Category not found'
            });
        }

        // Get subcategory IDs and their children IDs
        const subcategories = allCategories.filter(c => c.parent_category === category.id);
        const subcategoryIds = subcategories.map(c => c.id);

        const childCategories = allCategories.filter(c => subcategoryIds.includes(c.parent_category));
        const childCategoryIds = childCategories.map(c => c.id);

        const allTargetCategoryIds = [category.id, ...subcategoryIds, ...childCategoryIds];

        // Fetch products for these categories
        const { rows: products } = await query(
            `SELECT * FROM public."products" 
             WHERE category_id = ANY($1::int[]) AND status = 1 
             ORDER BY "order" ASC, "id" ASC`,
            [allTargetCategoryIds]
        );

        const serializedCategory = serializeCategoryDetail(category, allCategories);
        const serializedProducts = serializeProducts(products);

        return res.json({
            result: 'success',
            category: serializedCategory,
            products: serializedProducts
        });
    } catch (err) {
        next(err);
    }
}

export async function getCategoryList(req, res, next) {
    try {
        const { category: slug } = req.params;

        const { rows: allCategories } = await query(
            `SELECT * FROM public."categories" WHERE status = 1 ORDER BY "order" ASC, "id" ASC`
        );

        const category = allCategories.find(c => c.slug === slug);
        if (!category) {
            return res.status(404).json({
                result: 'error',
                message: 'Category not found'
            });
        }

        const directChildren = allCategories.filter(c => c.parent_category === category.id);
        const serializedChildren = serializeCategoryTree(directChildren, allCategories);
        const serializedCategory = serializeCategoryDetail(category, allCategories);

        return res.json({
            result: 'success',
            categories: serializedChildren,
            category: serializedCategory
        });
    } catch (err) {
        next(err);
    }
}
