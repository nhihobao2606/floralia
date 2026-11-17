const { ObjectId } = require('mongodb');
const AdminProduct = require('../models/adminProduct');

const DEFAULT_ACTIVE_STOCK = 20;
const ALLOWED_STATUSES = new Set(['active', 'inactive', 'out-of-stock']);

function slugify(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'san-pham';
}

function productStatus(product) {
    if (['out-of-stock', 'inactive', '\u0048\u1ebft h\u00e0ng'].includes(product.status)) return 'out-of-stock';
    if (['active', 'C\u00f2n h\u00e0ng'].includes(product.status)) return 'active';
    if (product.isActive === false || totalStock(product) === 0) return 'out-of-stock';
    return 'active';
}

function totalStock(product) {
    return Array.isArray(product.variants) && product.variants.length
        ? product.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0)
        : Math.max(0, Number(product.stock) || 0);
}

function imageUrl(product) {
    if (!product.thumbnail) return null;
    const thumbnail = String(product.thumbnail);
    if (/^(https?:|data:image\/)/i.test(thumbnail) || thumbnail.startsWith('/assets/')) return thumbnail;
    return `/products/image/${encodeURIComponent(thumbnail)}?v=${Date.now()}`;
}

async function withAdminFields(product) {
    const status = productStatus(product);
    let variants = Array.isArray(product.variants) ? product.variants.map(v => ({ ...v })) : [];
    let stock = totalStock(product);
    if (status === 'out-of-stock') {
        stock = 0;
        variants = variants.map(v => ({ ...v, stock: 0 }));
    } else if (stock === 0) {
        if (variants.length) {
            variants = variants.map(v => ({ ...v, stock: DEFAULT_ACTIVE_STOCK }));
            stock = variants.reduce((sum, v) => sum + v.stock, 0);
        } else {
            stock = DEFAULT_ACTIVE_STOCK;
        }
    }
    const baseSku = String(product.sku || '').split('-')[0].trim();
    const skuAssets = await AdminProduct.getProductAssetsBySku(baseSku);
    const canonicalThumbnail = skuAssets.find(asset => asset.assetId === `${baseSku}_THUMB`);
    const canonicalGallery = skuAssets
        .map(asset => ({ ...asset, imageIndex: String(asset.assetId || '').startsWith(`${baseSku}_IMG_`) ? String(asset.assetId).slice(`${baseSku}_IMG_`.length) : '' }))
        .filter(asset => /^\d+$/.test(asset.imageIndex) && Number(asset.imageIndex) >= 1)
        .sort((left, right) => Number(left.imageIndex) - Number(right.imageIndex))
        .map(asset => String(asset.assetId));
    const productForImages = canonicalThumbnail
        ? { ...product, thumbnail: canonicalThumbnail.assetId, images: canonicalGallery }
        : product;
    const imageReferences = [productForImages.thumbnail, ...(Array.isArray(productForImages.images) ? productForImages.images : [])]
        .filter(Boolean)
        .map(String);
    const assets = await AdminProduct.getAssetsByReferences(imageReferences);
    const referenceKeys = new Map();
    for (const asset of assets) {
        const duplicateKey = String(asset.assetId || asset._id || '');
        if (asset.assetId) referenceKeys.set(String(asset.assetId), duplicateKey);
        if (asset._id) referenceKeys.set(String(asset._id), duplicateKey);
    }
    const seen = new Set();
    const primaryReference = String(productForImages.thumbnail || '');
    const primaryKey = referenceKeys.get(primaryReference) || primaryReference;
    if (primaryKey) seen.add(primaryKey);
    const images = [...new Set((productForImages.images || []).filter(Boolean).map(String))].filter(reference => {
        if (reference === primaryReference) return false;
        const duplicateKey = referenceKeys.get(reference) || reference;
        if (duplicateKey && seen.has(duplicateKey)) return false;
        if (duplicateKey) seen.add(duplicateKey);
        return true;
    });

    return { ...productForImages, images, status, isActive: status === 'active', stock, variants, imageUrl: imageUrl(productForImages) };
}

function parseImages(body) {
    const uploads = Array.isArray(body.imageUploads) ? body.imageUploads : [];
    return uploads.map(image => {
        const match = typeof image?.dataUrl === 'string'
            ? image.dataUrl.match(/^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/i)
            : null;
        if (!match) {
            const error = new Error('\u1ea2nh s\u1ea3n ph\u1ea9m ph\u1ea3i \u0111\u01b0\u1ee3c chuy\u1ec3n sang WebP tr\u01b0\u1edbc khi t\u1ea3i l\u00ean.');
            error.status = 400;
            throw error;
        }
        const bytes = Buffer.from(match[1], 'base64');
        if (bytes.length > 10 * 1024 * 1024) {
            const error = new Error('Mỗi ảnh sản phẩm phải có dung lượng tối đa 10 MB.');
            error.status = 400;
            throw error;
        }
        if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
            const error = new Error('D\u1eef li\u1ec7u \u1ea3nh WebP kh\u00f4ng h\u1ee3p l\u1ec7.');
            error.status = 400;
            throw error;
        }
        return { mimeType: 'image/webp', data: match[1], fileName: String(image.name || 'product-image') };
    });
}

async function buildProduct(body, existing = null) {
    const name = String(body.name || '').trim();
    const sku = String(body.sku || '').trim().toUpperCase();
    const category = String(body.category || '').trim();
    if (!name || !sku || !category) {
        const error = new Error('Tên sản phẩm, SKU và danh mục là bắt buộc.');
        error.status = 400;
        throw error;
    }

    const price = Math.max(0, Number(body.price) || 0);
    const oldPrice = Math.max(0, Number(body.oldPrice) || 0);
    const rawVariants = Array.isArray(body.variants) ? body.variants : [];
    let variants = rawVariants.map((variant, index) => ({
        ...variant,
        sku: String(variant.sku || `${sku}-${index + 1}`).trim().toUpperCase(),
        label: String(variant.label || `Phân loại ${index + 1}`).trim(),
        price: Math.max(0, Number(variant.price) || 0),
        oldPrice: Math.max(0, Number(variant.oldPrice) || 0),
        stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
        isDefault: Boolean(variant.isDefault)
    }));
    if (variants.length && !variants.some(variant => variant.isDefault)) variants[0].isDefault = true;
    if (variants.length > 1) {
        let hasDefault = false;
        variants = variants.map(variant => {
            if (!variant.isDefault || hasDefault) return { ...variant, isDefault: false };
            hasDefault = true;
            return variant;
        });
    }

    const rawStatus = ALLOWED_STATUSES.has(body.status) ? body.status : 'active';
    const explicitlyOutOfStock = rawStatus === 'out-of-stock' || rawStatus === 'inactive';
    let baseStock = Math.max(0, Math.floor(Number(body.stock) || 0));
    if (explicitlyOutOfStock) {
        baseStock = 0;
        variants = variants.map(variant => ({ ...variant, stock: 0 }));
    } else if (variants.length) {
        baseStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    } else if (baseStock === 0) {
        baseStock = DEFAULT_ACTIVE_STOCK;
    }
    const status = explicitlyOutOfStock || baseStock === 0 ? '\u0048\u1ebft h\u00e0ng' : 'C\u00f2n h\u00e0ng';
    const defaultVariant = variants.find(variant => variant.isDefault) || variants[0];
    const productPrice = defaultVariant?.price ?? price;
    const productOldPrice = defaultVariant?.oldPrice ?? oldPrice;
    const createdAt = existing?.createdAt || new Date();
    const product = {
        sku,
        slug: String(body.slug || slugify(name)).trim(),
        name,
        category,
        categorySlug: String(body.categorySlug || slugify(category)).trim(),
        subCategory: String(body.subCategory || existing?.subCategory || '').trim(),
        isMix: body.isMix === true || body.isMix === 'true',
        featured: body.featured === true || body.featured === 'true',
        brand: String(body.brand || existing?.brand || 'Floralia Tea').trim(),
        shelfLifeMonths: Math.max(0, Number(body.shelfLifeMonths ?? existing?.shelfLifeMonths) || 0),
        flavorNote: String(body.flavorNote ?? existing?.flavorNote ?? '').trim(),
        color: String(body.color ?? existing?.color ?? '').trim(),
        hasVariants: variants.length > 0,
        variantLabel: String(body.variantLabel || existing?.variantLabel || 'Quy c\u00e1ch').trim(),
        variants,
        price: productPrice,
        oldPrice: productOldPrice,
        discount: productOldPrice > productPrice && productOldPrice > 0 ? Math.round((1 - productPrice / productOldPrice) * 100) : 0,
        isSale: productOldPrice > productPrice && productOldPrice > 0,
        minPrice: variants.length ? Math.min(...variants.map(variant => variant.price)) : productPrice,
        stock: baseStock,
        status,
        sold: Math.max(0, Number(existing?.sold ?? body.sold) || 0),
        benefits: Array.isArray(body.benefits) ? body.benefits.map(value => String(value).trim()).filter(Boolean) : (existing?.benefits || []),
        tags: Array.isArray(body.tags) ? body.tags.map(value => String(value).trim()).filter(Boolean) : (existing?.tags || []),
        thumbnail: existing?.thumbnail || String(body.thumbnail || '').trim(),
        images: [],
        ratingAverage: Number(existing?.ratingAverage) || 0,
        ratingCount: Number(existing?.ratingCount) || 0,
        ratingBreakdown: existing?.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        reviewCount: Number(existing?.reviewCount) || 0,
        description: String(body.description || '').trim(),
        story: String(body.story || '').trim(),
        usage: Array.isArray(body.usage) ? body.usage.map(value => String(value).trim()).filter(Boolean) : (existing?.usage || []),
        instructions: Array.isArray(body.instructions) ? body.instructions.map(value => String(value).trim()).filter(Boolean) : (existing?.instructions || []),
        isActive: true,
        createdAt,
        updatedAt: new Date()
    };
    for (const field of ['ingredients', 'descriptionDetails', 'weightGram', 'packCount', 'flavorCount', 'usageInstructions']) {
        if (body[field] !== undefined) product[field] = body[field];
        else if (existing?.[field] !== undefined) product[field] = existing[field];
    }

    // A new product must never inherit an existing ProductAssets reference from stale form state.
    const requestedThumbnail = existing ? String(body.thumbnail || '').trim() : '';
    const keptImages = existing && Array.isArray(body.images)
        ? body.images.map(image => String(image || '').trim()).filter(Boolean)
        : (existing ? (Array.isArray(existing.images) ? existing.images : []) : []);
    const normalizedKeptImages = keptImages.filter(image => image !== requestedThumbnail);
    const retainThumbnail = Boolean(existing?.thumbnail && !body.replaceImages && (!requestedThumbnail || requestedThumbnail === existing.thumbnail));
    const uploadedImages = await AdminProduct.insertImages(parseImages(body), sku, {
        createThumbnail: !requestedThumbnail && !retainThumbnail && normalizedKeptImages.length === 0,
        imageStartIndex: normalizedKeptImages.length + (existing?.thumbnail ? 1 : 0)
    });
    const uploadedThumbnail = !requestedThumbnail && !retainThumbnail && normalizedKeptImages.length === 0 ? uploadedImages[0] : '';
    // Full-size detail photos use IMG_1, IMG_2...; THUMB remains card-only.
    const uploadedGallery = uploadedThumbnail ? uploadedImages.slice(1) : uploadedImages;
    product.thumbnail = requestedThumbnail || uploadedThumbnail || (retainThumbnail ? existing.thumbnail : (normalizedKeptImages[0] || ''));
    product.images = [...normalizedKeptImages, ...uploadedGallery];
    return product;
}

async function getAdminProducts(req, res) {
    try {
        const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 8));
        const query = String(req.query.q || '').trim().toLowerCase();
        const category = String(req.query.category || 'all');
        const status = String(req.query.status || 'all');
        const allProducts = await AdminProduct.getAll();
        const categories = [...new Set(allProducts.map(product => product.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
        const stats = {
            total: allProducts.length,
            active: allProducts.filter(product => productStatus(product) === 'active').length,
            inactive: allProducts.filter(product => productStatus(product) === 'out-of-stock').length
        };
        const filtered = allProducts.filter(product => {
            const matchesQuery = !query || [product.name, product.sku, product.slug, product.category]
                .some(value => String(value || '').toLowerCase().includes(query));
            const matchesCategory = category === 'all' || product.category === category;
            const matchesStatus = status === 'all' || productStatus(product) === status || (status === 'out-of-stock' && totalStock(product) === 0);
            return matchesQuery && matchesCategory && matchesStatus;
        });
        const start = (page - 1) * limit;
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.json({
            data: await Promise.all(filtered.slice(start, start + limit).map(withAdminFields)),
            total: filtered.length,
            page,
            limit,
            stats,
            categories
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách quản lý sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Không thể tải danh sách sản phẩm.' });
    }
}

async function getAdminProduct(req, res) {
    try {
        const product = await AdminProduct.getById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        res.set('Pragma', 'no-cache');
        res.json(await withAdminFields(product));
    } catch (error) {
        console.error('Lỗi lấy sản phẩm quản trị:', error);
        res.status(500).json({ success: false, message: 'Không thể tải sản phẩm.' });
    }
}

async function createProduct(req, res) {
    try {
        const body = req.body || {};
        if (await AdminProduct.getBySku(String(body.sku || '').trim().toUpperCase())) {
            return res.status(409).json({ success: false, message: 'SKU sản phẩm đã tồn tại.' });
        }
        const product = await AdminProduct.create(await buildProduct(body));
        await AdminProduct.pruneProductAssets(product.sku, [product.thumbnail, ...(product.thumbnail ? [`${product.sku.split('-')[0]}_IMG_1`] : []), ...(product.images || [])]);
        AdminProduct.notifyProductChanged('created', product._id);
        res.status(201).json(await withAdminFields(product));
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'SKU sản phẩm đã tồn tại.' });
        }
        console.error('Lỗi tạo sản phẩm:', error);
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Không thể tạo sản phẩm.' });
    }
}

async function updateProduct(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.' });
        const existing = await AdminProduct.getById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        const body = req.body || {};
        if (await AdminProduct.getBySku(String(body.sku || '').trim().toUpperCase(), req.params.id)) {
            return res.status(409).json({ success: false, message: 'SKU sản phẩm đã tồn tại.' });
        }
        const product = await AdminProduct.update(req.params.id, await buildProduct(body, existing));
        if (product) await AdminProduct.pruneProductAssets(product.sku, [product.thumbnail, ...(product.thumbnail ? [`${product.sku.split('-')[0]}_IMG_1`] : []), ...(product.images || [])]);
        if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        AdminProduct.notifyProductChanged('updated', req.params.id);
        res.json(await withAdminFields(product));
    } catch (error) {
        console.error('Lỗi cập nhật sản phẩm:', error);
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Không thể cập nhật sản phẩm.' });
    }
}

async function deleteProduct(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.' });
        const product = await AdminProduct.getById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: 'Kh\u00f4ng t\u00ecm th\u1ea5y s\u1ea3n ph\u1ea9m.' });
        const result = await AdminProduct.remove(req.params.id);
        if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        await AdminProduct.removeProductAssetsBySkus([product.sku]);
        AdminProduct.notifyProductChanged('deleted', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Lỗi xóa sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Không thể xóa sản phẩm.' });
    }
}

async function deleteProductsBulk(req, res) {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some(id => typeof id !== 'string' || !ObjectId.isValid(id))) {
        return res.status(400).json({ success: false, message: 'Danh sách mã sản phẩm không hợp lệ.' });
    }
    const uniqueIds = [...new Set(ids)];
    try {
        const products = await AdminProduct.getByIds(uniqueIds);
        const result = await AdminProduct.removeMany(uniqueIds);
        if (result.deletedCount) {
            await AdminProduct.removeProductAssetsBySkus(products.map(product => product.sku));
        }
        uniqueIds.forEach(id => AdminProduct.notifyProductChanged('deleted', id));
        return res.json({ success: true, deletedCount: result.deletedCount || 0 });
    } catch (error) {
        console.error('Lỗi xóa nhiều sản phẩm:', error);
        return res.status(500).json({ success: false, message: 'Không thể xóa các sản phẩm đã chọn.' });
    }
}

module.exports = { getAdminProducts, getAdminProduct, createProduct, updateProduct, deleteProduct, deleteProductsBulk };
