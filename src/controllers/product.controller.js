import { query } from '../config/db.js';
import { serializeProductDetail } from '../helpers/serializers.js';

export async function getProductBySlug(req, res, next) {
    try {
        const { product: slug } = req.params;

        const { rows: products } = await query(
            `SELECT * FROM public."products" WHERE slug = $1 AND status = 1 LIMIT 1`,
            [slug]
        );

        if (products.length === 0) {
            return res.status(404).json({
                result: 'error',
                message: 'Product not found'
            });
        }

        const product = products[0];
        let category = null;

        if (product.category_id) {
            const { rows: categories } = await query(
                `SELECT * FROM public."categories" WHERE id = $1 LIMIT 1`,
                [product.category_id]
            );
            if (categories.length > 0) {
                category = categories[0];
            }
        }

        const serializedProduct = serializeProductDetail(product, category);

        return res.json({
            result: 'success',
            product: serializedProduct
        });
    } catch (err) {
        next(err);
    }
}
