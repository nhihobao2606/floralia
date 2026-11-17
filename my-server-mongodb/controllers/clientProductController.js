const Product = require('../models/product');
const AdminProduct = require('../models/adminProduct');

const DEFAULT_ACTIVE_STOCK = 20;

function totalStock(product) {
    return Array.isArray(product.variants) && product.variants.length
        ? product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0)
        : Math.max(0, Number(product.stock) || 0);
}

async function normalizeClientProduct(product, assetKeys, productAssets = null) {
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

    const baseSku = String(product.sku || '').split('-')[0].trim();
    const skuAssets = productAssets || await Product.getProductAssetsBySku(baseSku);
    const canonicalThumbnail = skuAssets.find(asset => asset.assetId === `${baseSku}_THUMB`);
    const canonicalGallery = skuAssets
        .map(asset => {
            const prefix = `${baseSku}_IMG_`;
            const suffix = String(asset.assetId || '').startsWith(prefix) ? String(asset.assetId).slice(prefix.length) : '';
            return { ...asset, index: /^\d+$/.test(suffix) ? Number(suffix) : 0 };
        })
        .filter(asset => asset.index >= 1)
        .sort((left, right) => left.index - right.index)
        .map(asset => String(asset.assetId));
    const hasCanonicalImages = canonicalGallery.length > 0;
    const thumbnail = canonicalThumbnail?.assetId || product.thumbnail;
    // THUMB serves cards; product detail uses full-size IMG_1, IMG_2...
    const images = hasCanonicalImages ? canonicalGallery : [...new Set((Array.isArray(product.images) ? product.images : [])
        .filter(Boolean)
        .map(String))];
    let resolvedAssetKeys = assetKeys;
    if (!resolvedAssetKeys) {
        const assets = await Product.getAssetsByThumbnails([thumbnail, ...images]);
        resolvedAssetKeys = new Map();
        for (const asset of assets) {
            const key = String(asset.assetId || asset._id || '');
            if (asset.assetId) resolvedAssetKeys.set(String(asset.assetId), key);
            if (asset._id) resolvedAssetKeys.set(String(asset._id), key);
        }
    }
    const seenImages = new Set();
    if (thumbnail) seenImages.add(resolvedAssetKeys.get(String(thumbnail)) || String(thumbnail));
    const uniqueImages = images.filter(image => {
        if (String(image) === String(thumbnail || '')) return false;
        const key = resolvedAssetKeys.get(String(image)) || String(image);
        if (seenImages.has(key)) return false;
        seenImages.add(key);
        return true;
    });
    return {
        ...product,
        imageData: null,
        imageMimeType: null,
        images: uniqueImages,
        status,
        isActive: true,
        stock,
        variants,
        imageId: thumbnail ? String(thumbnail) : null,
        imageUrl: thumbnail
            ? `/products/image/${encodeURIComponent(String(thumbnail))}?v=${Date.now()}`
            : null
    };
}

async function normalizeClientProducts(products) {
    const references = products.flatMap(product => [
        product.thumbnail,
        ...(Array.isArray(product.images) ? product.images : [])
    ]).filter(Boolean);
    const assets = await Product.getAssetsByThumbnails(references);
    const assetKeys = new Map();
    for (const asset of assets) {
        const key = String(asset.assetId || asset._id || '');
        if (asset.assetId) assetKeys.set(String(asset.assetId), key);
        if (asset._id) assetKeys.set(String(asset._id), key);
    }
    const productAssets = await Product.getProductAssetsBySkus(products.map(product => product.sku));
    const assetsBySku = new Map();
    const baseSkus = products.map(product => String(product.sku || '').split('-')[0].trim()).sort((a, b) => b.length - a.length);
    for (const asset of productAssets) {
        const assetId = String(asset.assetId || '');
        const sku = baseSkus.find(candidate => assetId.startsWith(`${candidate}_`)) || String(asset.productSku || '');
        const list = assetsBySku.get(sku) || [];
        list.push(asset);
        assetsBySku.set(sku, list);
    }
    return Promise.all(products.map(product => normalizeClientProduct(
        product,
        assetKeys,
        assetsBySku.get(String(product.sku || '').split('-')[0].trim()) || []
    )));
}

async function getClientProducts(req, res) {
    try {
        const products = await Product.getAll();
        const normalizedProducts = await normalizeClientProducts(products);
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

module.exports = { getClientProducts, getProductVersion, streamProductEvents, normalizeClientProduct, normalizeClientProducts };
