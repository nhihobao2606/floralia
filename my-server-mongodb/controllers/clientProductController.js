const Product = require('../models/product');
const AdminProduct = require('../models/adminProduct');

const DEFAULT_ACTIVE_STOCK = 20;

function totalStock(product) {
    return Array.isArray(product.variants) && product.variants.length
        ? product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0)
        : Math.max(0, Number(product.stock) || 0);
}

function normalizeClientProduct(product) {
    const isOutOfStock =
        product.status === 'out-of-stock' ||
        product.status === 'inactive' ||
        (product.status !== 'active' && (product.isActive === false || totalStock(product) === 0));

    const status = isOutOfStock ? 'out-of-stock' : 'active';
    let variants = Array.isArray(product.variants) ? product.variants.map(variant => ({ ...variant })) : [];
    let stock = totalStock(product);

    if (status === 'out-of-stock') {
        stock = 0;
        variants = variants.map(variant => ({ ...variant, stock: 0 }));
    } else if (stock === 0) {
        if (variants.length) {
            variants = variants.map(variant => ({ ...variant, stock: DEFAULT_ACTIVE_STOCK }));
            stock = variants.reduce((sum, variant) => sum + variant.stock, 0);
        } else {
            stock = DEFAULT_ACTIVE_STOCK;
        }
    }

    const thumbnail = product.thumbnail;
    return {
        ...product,
        status,
        isActive: true,
        stock,
        variants,
        imageId: thumbnail ? String(thumbnail) : null,
        imageUrl: thumbnail
            ? `/products/image/${encodeURIComponent(String(thumbnail))}`
            : null
    };
}

async function getClientProducts(req, res) {
    try {
        const products = await Product.getAll();
        const normalizedProducts = products.map(normalizeClientProduct);
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.json(normalizedProducts);
    } catch (error) {
        console.error('Lỗi lấy danh sách sản phẩm đang kinh doanh:', error);
        res.status(500).json({ message: 'Không thể lấy danh sách sản phẩm.' });
    }
}

function getProductVersion(req, res) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ version: AdminProduct.getVersion() });
}

function streamProductEvents(req, res) {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ version: AdminProduct.getVersion(), action: 'connected' })}\n\n`);

    const onChanged = (payload) => {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    AdminProduct.productEvents.on('changed', onChanged);

    req.on('close', () => {
        AdminProduct.productEvents.off('changed', onChanged);
    });
}

module.exports = { getClientProducts, getProductVersion, streamProductEvents, normalizeClientProduct };
