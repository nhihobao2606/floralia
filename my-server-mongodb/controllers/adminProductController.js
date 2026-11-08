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
    if (product.status === 'out-of-stock' || product.status === 'inactive') return 'out-of-stock';
    if (product.status === 'active') return 'active';
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
    return `/products/image/${encodeURIComponent(thumbnail)}`;
}

function withAdminFields(product) {
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
    return { ...product, status, isActive: status === 'active', stock, variants, imageUrl: imageUrl(product) };
}

function parseImages(body) {
    const uploads = Array.isArray(body.imageUploads) ? body.imageUploads : [];
    return uploads.map((image) => {
        const match = typeof image?.dataUrl === 'string'
            ? image.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/)
            : null;
        if (!match) return null;
        return { mimeType: match[1], data: match[2], fileName: String(image.name || 'product-image') };
    }).filter(Boolean);
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
    const status = rawStatus === 'inactive' ? 'out-of-stock' : rawStatus;
    let baseStock = Math.max(0, Math.floor(Number(body.stock) || 0));
    if (status === 'out-of-stock') {
        baseStock = 0;
        variants = variants.map(variant => ({ ...variant, stock: 0 }));
    } else {
        if (variants.length) {
            const totalVarStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
            if (totalVarStock === 0) {
                variants = variants.map(variant => ({ ...variant, stock: DEFAULT_ACTIVE_STOCK }));
            }
            baseStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
        } else if (baseStock === 0) {
            baseStock = DEFAULT_ACTIVE_STOCK;
        }
    }

    const product = {
        sku,
        slug: String(body.slug || slugify(name)).trim(),
        name,
        brand: String(body.brand || 'Floralia Tea').trim(),
        category,
        categorySlug: String(body.categorySlug || slugify(category)).trim(),
        subCategory: String(body.subCategory || '').trim(),
        status,
        isActive: true,
        price,
        oldPrice,
        minPrice: variants.length ? Math.min(...variants.map(variant => variant.price)) : price,
        discount: oldPrice > price && oldPrice > 0 ? Math.round((1 - price / oldPrice) * 100) : 0,
        isSale: oldPrice > price && oldPrice > 0,
        stock: baseStock,
        description: String(body.description || '').trim(),
        story: String(body.story || '').trim(),
        benefits: Array.isArray(body.benefits) ? body.benefits.map(value => String(value).trim()).filter(Boolean) : [],
        usageInstructions: String(body.usageInstructions || '').trim(),
        tags: Array.isArray(body.tags) ? body.tags.map(value => String(value).trim()).filter(Boolean) : [],
        variants,
        featured: Boolean(body.featured),
        isMix: Boolean(body.isMix),
        flavorNote: String(body.flavorNote || '').trim(),
        color: String(body.color || '').trim(),
        shelfLifeMonths: Math.max(0, Number(body.shelfLifeMonths) || 0),
        sold: Math.max(0, Number(existing?.sold ?? body.sold) || 0),
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date()
    };
    if (existing) {
        product.thumbnail = existing.thumbnail || '';
        product.images = Array.isArray(existing.images) ? existing.images : [];
        for (const field of ['ingredients', 'descriptionDetails', 'weightGram', 'packCount', 'flavorCount', 'variantLabel']) {
            if (body[field] !== undefined) product[field] = body[field];
            else if (existing[field] !== undefined) product[field] = existing[field];
        }
    } else {
        product.thumbnail = '';
        product.images = [];
    }
    for (const field of ['ingredients', 'descriptionDetails', 'weightGram', 'packCount', 'flavorCount']) {
        if (body[field] !== undefined) product[field] = body[field];
        else if (existing?.[field] !== undefined) product[field] = existing[field];
    }
    product.usage = Array.isArray(body.usage) ? body.usage.map(value => String(value).trim()).filter(Boolean) : (existing?.usage || []);
    product.instructions = Array.isArray(body.instructions) ? body.instructions.map(value => String(value).trim()).filter(Boolean) : (existing?.instructions || []);
    product.hasVariants = variants.length > 0;
    product.variantLabel = String(body.variantLabel || existing?.variantLabel || 'Quy cách');
    if (variants.length) {
        const defaultVariant = variants.find(variant => variant.isDefault) || variants[0];
        product.price = defaultVariant.price;
        product.oldPrice = defaultVariant.oldPrice;
        product.minPrice = Math.min(...variants.map(variant => variant.price));
        product.discount = product.oldPrice > product.price && product.oldPrice > 0
            ? Math.round((1 - product.price / product.oldPrice) * 100)
            : 0;
        product.isSale = product.discount > 0;
        product.stock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    }

    const uploadedImages = await AdminProduct.insertImages(parseImages(body), sku);
    const keptImages = Array.isArray(body.images)
        ? body.images.map(image => String(image || '').trim()).filter(Boolean)
        : (existing ? (Array.isArray(existing.images) ? existing.images : (existing.thumbnail ? [existing.thumbnail] : [])) : []);
    if (body.replaceImages && !keptImages.length) {
        product.images = uploadedImages;
        product.thumbnail = product.images[0] || '';
    } else {
        product.images = [...keptImages, ...uploadedImages];
        product.thumbnail = product.images[0] || '';
    }
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
        res.json({
            data: filtered.slice(start, start + limit).map(withAdminFields),
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
        res.json(withAdminFields(product));
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
        AdminProduct.notifyProductChanged('created', product._id);
        res.status(201).json(withAdminFields(product));
    } catch (error) {
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
        if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        AdminProduct.notifyProductChanged('updated', req.params.id);
        res.json(withAdminFields(product));
    } catch (error) {
        console.error('Lỗi cập nhật sản phẩm:', error);
        res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Không thể cập nhật sản phẩm.' });
    }
}

async function deleteProduct(req, res) {
    try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, message: 'Mã sản phẩm không hợp lệ.' });
        const result = await AdminProduct.remove(req.params.id);
        if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
        AdminProduct.notifyProductChanged('deleted', req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Lỗi xóa sản phẩm:', error);
        res.status(500).json({ success: false, message: 'Không thể xóa sản phẩm.' });
    }
}

module.exports = { getAdminProducts, getAdminProduct, createProduct, updateProduct, deleteProduct };
