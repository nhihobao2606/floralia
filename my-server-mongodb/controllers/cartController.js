const Cart = require('../models/cart');
const User = require('../models/user');
const Product = require('../models/product');

function resolveCartImage(product) {
    const thumbnail = product?.thumbnail;
    if (!thumbnail) return '';
    const value = String(thumbnail);
    if (/^(https?:|data:image\/|blob:)/i.test(value) || value.startsWith('/assets/')) return value;
    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(value)) return `/assets/images/${value}`;
    return `http://localhost:3002/products/image/${encodeURIComponent(value)}`;
}

async function hydrateCartItem(item) {
    const lookupSku = item.productSku || item.variantSku;
    let product = lookupSku ? await Product.getBySku(lookupSku) : null;
    if (!product && item.productId) product = await Product.getById(String(item.productId));
    if (!product) return null;

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variant = item.variantSku
        ? variants.find(candidate => String(candidate.sku) === item.variantSku)
        : null;
    if (item.variantSku && !variant) return null;

    const price = Number(variant?.price ?? product.price ?? product.minPrice ?? 0);
    const oldPrice = Number(variant?.oldPrice ?? product.oldPrice ?? price);
    const image = resolveCartImage(product);
    return {
        id: item.variantSku || product.sku || item.productId,
        productId: String(product._id || item.productId || product.sku || ''),
        productSku: String(product.sku || item.productSku || ''),
        variantSku: item.variantSku || '',
        sku: item.variantSku || product.sku || '',
        name: product.name || product.title || '',
        title: product.name || product.title || '',
        slug: product.slug || '',
        price,
        oldPrice: oldPrice > price ? oldPrice : price,
        discount: Math.max(0, Math.min(99, Number(product.discount) || 0)),
        quantity: item.quantity,
        stock: Number(variant?.stock ?? product.stock ?? 0),
        image,
        thumbnail: image,
        variantLabel: variant?.label || '',
        variantCount: variants.length,
        variants: variants.map(option => ({
            sku: option.sku,
            label: option.label,
            price: Number(option.price || 0),
            oldPrice: Number(option.oldPrice || option.price || 0),
            stock: Number(option.stock || 0),
            isDefault: Boolean(option.isDefault)
        })),
        addedAt: item.addedAt
    };
}

// GET /api/cart - Lấy giỏ hàng của user đang đăng nhập từ collection Cart
async function getCart(req, res) {
    try {
        const user = await User.getById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng.'
            });
        }

        const cartDoc = await Cart.getByUser(req.userId);
        const storedItems = Array.isArray(cartDoc?.items) ? cartDoc.items : [];
        const normalizedItems = Cart.normalizeItems(storedItems);
        const hydratedItems = await Promise.all(normalizedItems.map(hydrateCartItem));
        const items = hydratedItems.filter(Boolean);

        // Remove legacy product snapshots (including stale prices) from the Cart collection.
        if (cartDoc && (
            JSON.stringify(storedItems) !== JSON.stringify(normalizedItems) ||
            items.length !== normalizedItems.length ||
            cartDoc.email || cartDoc.fullName
        )) {
            await Cart.saveByUser(req.userId, normalizedItems.filter((_, index) => hydratedItems[index]));
        }
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json({
            success: true,
            exists: Boolean(cartDoc),
            items
        });
    } catch (err) {
        console.error('Lỗi lấy giỏ hàng từ MongoDB:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể tải giỏ hàng.'
        });
    }
}

// PUT /api/cart - Lưu giỏ hàng của user đang đăng nhập xuống collection Cart
async function updateCart(req, res) {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const user = await User.getById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng.'
            });
        }

        const normalizedItems = Cart.normalizeItems(items);
        const result = await Cart.saveByUser(req.userId, normalizedItems);
        if (result?.acknowledged !== true) {
            return res.status(500).json({ success: false, message: 'Không thể xác nhận giỏ hàng đã được lưu.' });
        }

        res.json({
            success: true,
            items: normalizedItems
        });
    } catch (err) {
        console.error('Lỗi lưu giỏ hàng xuống MongoDB:', err);
        res.status(500).json({
            success: false,
            message: 'Không thể lưu giỏ hàng.'
        });
    }
}

module.exports = {
    getCart,
    updateCart
};

