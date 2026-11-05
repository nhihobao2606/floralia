const { ObjectId } = require('mongodb');
const Product = require('../models/product');
const User = require('../models/user');

// GET /products
async function getProducts(req, res) {
    try {
        const products = await Product.getAll();

        // Không tải dữ liệu ảnh ở API danh sách
        const result = products.map(product => {
            const thumbnail = product.thumbnail;
            let imageId = thumbnail;

            return {
                ...product,
                imageId: imageId ? String(imageId) : null,
                imageUrl: imageId
                    ? `/products/image/${encodeURIComponent(String(imageId))}`
                    : null
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Lỗi lấy danh sách sản phẩm:', error);

        res.status(500).json({
            message: 'Không thể lấy danh sách sản phẩm'
        });
    }
}

// GET /products/image/:id
async function getProductImage(req, res) {
    try {
        const id = req.params.id;
        let asset = null;

        // Tìm theo _id nếu thumbnail là ObjectId
        if (ObjectId.isValid(id)) {
            asset = await Product.getAssetById(id);
        }

        // Nếu không tìm thấy, thử tìm theo assetId
        if (!asset) {
            asset = await Product.getByAssetId(id);
        }

        // Nếu không tìm thấy, thử tìm theo tên file
        if (!asset) {
            asset = await Product.getByFileName(id);
        }

        if (!asset || !asset.data) {
            return res.status(404).end();
        }

        const mimeType = asset.mimeType || 'image/jpeg';

        // Hỗ trợ dữ liệu ảnh lưu dạng Buffer hoặc Base64
        const imageBuffer = Buffer.isBuffer(asset.data)
            ? asset.data
            : Buffer.from(String(asset.data), 'base64');

        res.set('Content-Type', mimeType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(imageBuffer);
    } catch (error) {
        console.error('Lỗi lấy ảnh sản phẩm:', error);

        res.status(500).json({
            message: 'Không thể lấy ảnh sản phẩm'
        });
    }
}

// GET /products/reviews/:sku
async function getProductReviews(req, res) {
    try {
        const reviews = await Product.getApprovedReviewsBySku(req.params.sku);
        res.json(reviews);
    } catch (error) {
        console.error('Lỗi lấy đánh giá sản phẩm:', error);
        res.status(500).json({
            message: 'Không thể lấy đánh giá sản phẩm'
        });
    }
}

// POST /products/reviews
async function createProductReview(req, res) {
    const { productSku, rating, comment } = req.body || {};
    const normalizedSku = typeof productSku === 'string' ? productSku.trim() : '';
    const normalizedComment = typeof comment === 'string' ? comment.trim() : '';

    if (
        !normalizedSku ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        !normalizedComment ||
        normalizedComment.length > 2000
    ) {
        return res.status(400).json({
            message: 'Vui lòng chọn đánh giá từ 1 đến 5 sao và nhập bình luận tối đa 2000 ký tự.'
        });
    }

    try {
        const user = await User.getById(req.userId);
        const normalizedName = typeof user?.fullName === 'string' ? user.fullName.trim() : '';
        if (!normalizedName) {
            return res.status(401).json({
                message: 'Không thể xác thực tài khoản. Vui lòng đăng nhập lại.'
            });
        }

        const product = await Product.getBySku(normalizedSku);
        if (!product) {
            return res.status(404).json({
                message: 'Không tìm thấy sản phẩm để lưu đánh giá.'
            });
        }

        const review = await Product.createReview({
            productSku: normalizedSku,
            userName: normalizedName,
            userAvatar: user.avatar || null,
            rating,
            comment: normalizedComment,
            createdAt: new Date(),
            isApproved: true
        });

        return res.status(201).json(review);
    } catch (error) {
        console.error('Lỗi lưu đánh giá sản phẩm:', error);
        return res.status(500).json({
            message: 'Không thể lưu đánh giá sản phẩm'
        });
    }
}

// GET /products/slug/:slug
async function getProductBySlug(req, res) {
    const slug = String(req.params.slug || '').trim();
    if (!slug) {
        return res.status(400).json({
            message: 'Slug sản phẩm không hợp lệ'
        });
    }

    try {
        const product = await Product.getBySlug(slug);
        if (!product) {
            return res.status(404).json({
                message: 'Không tìm thấy sản phẩm'
            });
        }

        const thumbnail = product.thumbnail;
        let asset = null;

        if (thumbnail !== undefined && thumbnail !== null) {
            const thumbnailString = String(thumbnail);

            if (ObjectId.isValid(thumbnailString)) {
                asset = await Product.getAssetById(thumbnailString);
            }

            if (!asset) {
                asset = await Product.getByAssetId(thumbnailString);
            }

            if (!asset) {
                asset = await Product.getByFileName(thumbnailString);
            }
        }

        return res.json({
            ...product,
            imageUrl: thumbnail
                ? `/products/image/${encodeURIComponent(String(thumbnail))}`
                : null
        });
    } catch (error) {
        console.error('Lỗi lấy chi tiết sản phẩm theo slug:', error);

        return res.status(500).json({
            message: 'Không thể lấy chi tiết sản phẩm'
        });
    }
}

// GET /products/:id
async function getProductById(req, res) {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                message: 'ID sản phẩm không hợp lệ'
            });
        }

        const product = await Product.getById(id);

        if (!product) {
            return res.status(404).json({
                message: 'Không tìm thấy sản phẩm'
            });
        }

        const thumbnail = product.thumbnail;
        let asset = null;

        if (thumbnail !== undefined && thumbnail !== null) {
            const thumbnailString = String(thumbnail);

            if (ObjectId.isValid(thumbnailString)) {
                asset = await Product.getAssetById(thumbnailString);
            }

            if (!asset) {
                asset = await Product.getByAssetId(thumbnailString);
            }

            if (!asset) {
                asset = await Product.getByFileName(thumbnailString);
            }
        }

        // Không trả dữ liệu ảnh Base64 trong response chi tiết
        res.json({
            ...product,
            imageUrl: thumbnail
                ? `/products/image/${encodeURIComponent(String(thumbnail))}`
                : null
        });
    } catch (error) {
        console.error('Lỗi lấy chi tiết sản phẩm:', error);

        res.status(500).json({
            message: 'Không thể lấy chi tiết sản phẩm'
        });
    }
}

async function getProductBySlug(req, res) {
    try {
        const product = await Product.getBySlug(req.params.slug);
        if (!product || product.isActive === false) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }

        res.json({
            ...product,
            imageUrl: product.thumbnail
                ? `/products/image/${encodeURIComponent(String(product.thumbnail))}`
                : null
        });
    } catch (error) {
        console.error('Lỗi lấy sản phẩm theo slug:', error);
        res.status(500).json({ message: 'Không thể lấy sản phẩm' });
    }
}

async function getProductBySku(req, res) {
    try {
        const sku = req.params.sku;
        const product = await Product.getBySku(sku);
        if (!product || product.isActive === false) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }

        const variants = Array.isArray(product.variants) ? product.variants : [];
        const variant = variants.find(candidate => candidate.sku === sku) ||
            (product.sku === sku
                ? variants.find(candidate => candidate.label === req.query.variant)
                : null);
        const thumbnail = product.thumbnail;
        res.json({
            sku,
            name: product.name,
            imageUrl: thumbnail
                ? `/products/image/${encodeURIComponent(String(thumbnail))}`
                : null,
            variant: variant?.label || '',
            price: Number(variant?.price ?? product.price),
            oldPrice: Number(variant?.oldPrice ?? product.oldPrice ?? variant?.price ?? product.price),
            stock: Number(variant?.stock ?? product.stock),
            productDiscount: Math.max(
                0,
                Number(variant?.oldPrice ?? product.oldPrice ?? 0) - Number(variant?.price ?? product.price)
            )
        });
    } catch (error) {
        console.error('Lỗi lấy sản phẩm theo SKU:', error);
        res.status(500).json({ message: 'Không thể lấy sản phẩm' });
    }
}

module.exports = {
    getProducts,
    getProductById,
    getProductBySlug,
    getProductBySku,
    getProductImage,
    getProductReviews,
    createProductReview
};