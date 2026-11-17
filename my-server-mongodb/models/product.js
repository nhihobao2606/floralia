const { ObjectId } = require('mongodb');
const Category = require('./category');
const path = require('path');
const fs = require('fs');

let productsCollection;
let productAssetsCollection;
let reviewsCollection;
let inventoryAdjustmentsCollection;
let mongoClient;

let localCatalog = null;
function getLocalCatalog() {
    if (!localCatalog) {
        try {
            const pPath = path.join(__dirname, '../../client/src/app/data/products.updated.json');
            if (fs.existsSync(pPath)) {
                localCatalog = JSON.parse(fs.readFileSync(pPath, 'utf8'));
            } else {
                const fallbackPath = path.join(__dirname, '../../client/src/app/data/products.json');
                localCatalog = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
            }
        } catch {
            localCatalog = [];
        }
    }
    return localCatalog;
}

function setCollections(products, productAssets, reviews, client) {
    productsCollection = products;
    productAssetsCollection = productAssets;
    reviewsCollection = reviews;
    mongoClient = client || products?.s?.db?.client || null;
    if (products?.s?.db) {
        Category.setCollection(products.s.db.collection('Categories'));
      inventoryAdjustmentsCollection = products.s.db.collection('InventoryAdjustments');
    }
}

async function bulkAdjustStock(items, batchCode) {
    if (!productsCollection || !mongoClient || !inventoryAdjustmentsCollection) throw new Error('MongoDB inventory transaction is not available');
    const session = mongoClient.startSession();
    const updatedAt = new Date();
    try {
        await session.withTransaction(async () => {
            const products = await productsCollection.find({ isActive: { $ne: false }, $or: [
                { sku: { $in: items.map(item => item.productSku || item.sku) } },
                { 'variants.sku': { $in: items.map(item => item.sku) } }
            ] }, { session }).toArray();
            const changesByProduct = new Map();
            const records = [];
            for (const item of items) {
                const product = products.find(candidate => candidate.sku === (item.productSku || item.sku) || candidate.variants?.some(variant => variant.sku === item.sku));
                if (!product) throw new Error(`Không tìm thấy SKU ${item.sku}`);
                const variant = product.variants?.find(candidate => candidate.sku === item.sku || (item.variantLabel && candidate.label === item.variantLabel));
                if (product.variants?.length && !variant) throw new Error(`Không tìm thấy phân loại ${item.sku}`);
                const current = Number(variant?.stock ?? product.stock) || 0;
                if (!changesByProduct.has(product._id.toString())) changesByProduct.set(product._id.toString(), { product, variants: (product.variants || []).map(value => ({ ...value })), stock: Number(product.stock) || 0 });
                const change = changesByProduct.get(product._id.toString());
                if (variant) {
                    const updatedVariant = change.variants.find(value => value.sku === variant.sku);
                    updatedVariant.stock = item.stock;
                    updatedVariant.stockAdjustmentReason = item.reason;
                    updatedVariant.updatedAt = updatedAt;
                    change.stock += item.stock - current;
                } else {
                    change.stock = item.stock;
                }
                records.push({ batchCode, sku: item.sku, productSku: product.sku, variantLabel: variant?.label || 'Tiêu chuẩn', previousStock: current, newStock: item.stock, reason: item.reason, createdAt: updatedAt });
            }
            for (const change of changesByProduct.values()) {
                const stock = change.variants.length ? change.variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0) : change.stock;
                await productsCollection.updateOne({ _id: change.product._id }, { $set: { variants: change.variants, stock, updatedAt, stockAdjustmentReason: records.find(record => record.productSku === change.product.sku)?.reason || '' } }, { session });
            }
            await inventoryAdjustmentsCollection.insertMany(records, { session });
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } finally {
        await session.endSession();
    }
}

async function withTransaction(work) {
    if (!mongoClient) throw new Error('MongoDB transaction client is not available');
    const session = mongoClient.startSession();
    try {
        return await session.withTransaction(() => work(session), {
            readConcern: { level: 'snapshot' },
            writeConcern: { w: 'majority' }
        });
    } finally {
        await session.endSession();
    }
}

// Products - lấy tất cả sản phẩm từ MongoDB Product collection (bao gồm cả sản phẩm mới thêm từ Admin)
async function getAll() {
    let products = [];
    if (productsCollection) {
        products = await productsCollection.find({
            isActive: { $ne: false }
        }).toArray();
    }

    const assetSkus = productAssetsCollection
        ? await productAssetsCollection.distinct('productSku')
        : [];
    const assetSkuSet = new Set(Array.isArray(assetSkus) ? assetSkus : []);

    // Nếu MongoDB collection rỗng thì fallback về catalog local
    if (products.length === 0 && assetSkuSet.size > 0) {
        const catalog = getLocalCatalog();
        products = catalog.filter(p => assetSkuSet.has(p.sku) && p.isActive !== false);
    }

    // Attach ratings from MongoDB Reviews collection
    const productSkus = products
        .map(product => product.sku)
        .filter(sku => typeof sku === 'string' && sku.length > 0);
    const ratingSummaries = (productSkus.length && reviewsCollection)
        ? await reviewsCollection.aggregate([
            {
                $match: {
                    productSku: { $in: productSkus },
                    isApproved: true
                }
            },
            {
                $group: {
                    _id: '$productSku',
                    ratingAverage: { $avg: '$rating' },
                    ratingCount: { $sum: 1 }
                }
            }
        ]).toArray()
        : [];
    const ratingsBySku = new Map(
        ratingSummaries.map(summary => [summary._id, summary])
    );

    return products.map(product => {
        const summary = ratingsBySku.get(product.sku);
        const thumbnail = product.thumbnail || '';
        return {
            ...product,
            thumbnail,
            ratingAverage: summary?.ratingAverage ?? (product.ratingAverage ?? 0),
            ratingCount: summary?.ratingCount ?? (product.ratingCount ?? 0)
        };
    });
}

async function getById(id) {
    if (!id) return null;

    let product = null;
    if (productsCollection && ObjectId.isValid(id)) {
        product = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (product) return product;
    }

    const catalog = getLocalCatalog();
    product = catalog.find(p => String(p._id) === String(id) || p.sku === id) || null;
    return product;
}

async function getBySku(sku) {
    if (!sku) return null;
    const baseSku = String(sku).split('-')[0].trim();

    if (productsCollection) {
        const product = await productsCollection.findOne({
            $or: [
                { sku },
                { 'variants.sku': sku },
                { sku: baseSku }
            ]
        });
        if (product) return product;
    }

    const catalog = getLocalCatalog();
    return catalog.find(p =>
        p.sku === sku ||
        p.sku === baseSku ||
        (Array.isArray(p.variants) && p.variants.some(v => v.sku === sku))
    ) || null;
}

async function getBySlug(slug) {
    if (!slug) return null;

    if (productsCollection) {
        const product = await productsCollection.findOne({ slug });
        if (product) return product;
    }

    const catalog = getLocalCatalog();
    return catalog.find(p => p.slug === slug) || null;
}

function getBySlug(slug) {
    return productsCollection.findOne({ slug });
}

function incrementSoldBySku(sku, quantity, session) {
    if (!productsCollection) return Promise.resolve({ matchedCount: 0 });
    return productsCollection.updateOne(
        { $or: [{ sku }, { 'variants.sku': sku }] },
        { $inc: { sold: quantity } },
        session ? { session } : {}
    );
}

function decrementSoldBySku(sku, quantity, session) {
    if (!productsCollection) return Promise.resolve({ matchedCount: 0 });
    return productsCollection.updateOne(
        {
            $and: [
                { $or: [{ sku }, { 'variants.sku': sku }] },
                { sold: { $gte: quantity } }
            ]
        },
        { $inc: { sold: -quantity } },
        session ? { session } : {}
    );
}

async function getInventoryProducts() {
    if (!productsCollection) throw new Error('MongoDB Product collection is not available');
    return productsCollection.find({ isActive: { $ne: false } }, {
        projection: { sku: 1, name: 1, category: 1, price: 1, importPrice: 1, stock: 1, thumbnail: 1, variants: 1 }
    }).sort({ sku: 1 }).toArray();
}

async function setStockBySku(sku, stock, reason = '', importPrice, productSku, variantLabel) {
    if (!productsCollection) throw new Error('MongoDB Product collection is not available');
    const updatedAt = new Date();
    let variantProduct = await productsCollection.findOne({ 'variants.sku': sku, isActive: { $ne: false } });
    if (!variantProduct && productSku) {
        variantProduct = await productsCollection.findOne({ sku: productSku, isActive: { $ne: false } });
    }
    if (variantProduct) {
        const selectedVariant = (variantProduct.variants || []).find(variant =>
            variant.sku === sku || (variantLabel && variant.label === variantLabel)
        );
        if (selectedVariant) {
        const currentVariantStock = Number(selectedVariant.stock) || 0;
        const variantFields = {
            'variants.$.stock': stock,
            'variants.$.stockAdjustmentReason': reason,
            'variants.$.updatedAt': updatedAt,
            updatedAt,
            stockAdjustmentReason: reason,
        };
        if (importPrice !== undefined) variantFields['variants.$.importPrice'] = importPrice;
        return productsCollection.updateOne(
            { _id: variantProduct._id, 'variants.sku': selectedVariant.sku },
            { $set: variantFields, $inc: { stock: stock - currentVariantStock } }
        );
        }
        if (Array.isArray(variantProduct.variants) && variantProduct.variants.length > 0) return { matchedCount: 0 };
    }
    const fields = { stock, updatedAt, stockAdjustmentReason: reason };
    if (importPrice !== undefined) fields.importPrice = importPrice;
    return productsCollection.updateOne(
        { sku: productSku || sku, isActive: { $ne: false } },
        { $set: fields }
    );
}

async function adjustStockBySku(sku, stock, reason = '', productSku = '', variantLabel = '') {
    if (!productsCollection || !mongoClient || !inventoryAdjustmentsCollection) {
        throw new Error('MongoDB inventory transaction is not available');
    }
    const session = mongoClient.startSession();
    const updatedAt = new Date();
    const dateCode = updatedAt.toISOString().slice(0, 10).replaceAll('-', '');
    const batchCode = `ADJ-${dateCode}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    let updateResult = { matchedCount: 0 };
    try {
        await session.withTransaction(async () => {
            let product = await productsCollection.findOne(
                { 'variants.sku': sku, isActive: { $ne: false } },
                { session }
            );
            if (!product) {
                product = await productsCollection.findOne(
                    { sku: productSku || sku, isActive: { $ne: false } },
                    { session }
                );
            }
            if (!product) return;

            const variants = Array.isArray(product.variants) ? product.variants.map(variant => ({ ...variant })) : [];
            const variant = variants.find(item => item.sku === sku || (variantLabel && item.label === variantLabel));
            if (variants.length && !variant) throw new Error('Variant not found: ' + (variantLabel || sku));

            const previousStock = Number(variant?.stock ?? product.stock) || 0;
            if (variant) {
                variant.stock = stock;
                variant.stockAdjustmentReason = reason;
                variant.updatedAt = updatedAt;
            }
            const totalStock = variants.length
                ? variants.reduce((sum, item) => sum + (Number(item.stock) || 0), 0)
                : stock;
            updateResult = await productsCollection.updateOne(
                { _id: product._id },
                { $set: {
                    ...(variants.length ? { variants } : {}),
                    stock: totalStock,
                    updatedAt,
                    stockAdjustmentReason: reason,
                } },
                { session }
            );
            if (updateResult.matchedCount !== 1) throw new Error('Could not update SKU ' + sku);
            await inventoryAdjustmentsCollection.insertOne({
                batchCode,
                sku,
                productSku: product.sku,
                variantLabel: variant?.label || variantLabel || 'Tiêu chuẩn',
                previousStock,
                newStock: stock,
                reason,
                createdAt: updatedAt,
            }, { session });
        }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
        return updateResult;
    } finally {
        await session.endSession();
    }
}

async function addStockBulk(items, reason = '') {
    if (!productsCollection) throw new Error('MongoDB Product collection is not available');
    if (!items.length) return;
    for (const item of items) {
        const variantProduct = await productsCollection.findOne({ 'variants.sku': item.sku, isActive: { $ne: false } });
        const updatedAt = new Date();
        if (variantProduct) {
            const variants = (variantProduct.variants || []).map(variant => {
                if (variant.sku !== item.sku) return variant;
                const updatedVariant = {
                    ...variant,
                    stock: (Number(variant.stock) || 0) + item.quantity,
                    stockAdjustmentReason: reason,
                    updatedAt,
                };
                if (item.importPrice !== undefined) updatedVariant.importPrice = item.importPrice;
                return updatedVariant;
            });
            const stock = variants.reduce((sum, variant) => sum + (Number(variant.stock) || 0), 0);
            await productsCollection.updateOne(
                { _id: variantProduct._id },
                { $set: { variants, stock, updatedAt, stockAdjustmentReason: reason } }
            );
            continue;
        }
        const fields = { updatedAt, stockAdjustmentReason: reason };
        if (item.importPrice !== undefined) fields.importPrice = item.importPrice;
        await productsCollection.updateOne(
            { sku: item.sku, isActive: { $ne: false } },
            { $inc: { stock: item.quantity }, $set: fields }
        );
    }
}

async function deductStockBulk(items, session) {
    if (!productsCollection) throw new Error('MongoDB Product collection is not available');
    if (!session) throw new Error('MongoDB stock deduction requires a transaction session');

    const updatedAt = new Date();
    for (const item of items) {
        const sku = String(item.sku || '').trim();
        const quantity = Number(item.quantity);
        if (!sku || !Number.isSafeInteger(quantity) || quantity < 1) {
            throw new Error('Invalid SKU or quantity for stock deduction');
        }

        const variantProduct = await productsCollection.findOne(
            { 'variants.sku': sku, isActive: { $ne: false } },
            { session, projection: { _id: 1 } }
        );
        const result = variantProduct
            ? await productsCollection.updateOne(
                {
                    _id: variantProduct._id,
                    variants: { $elemMatch: { sku, stock: { $gte: quantity } } }
                },
                {
                    $inc: { 'variants.$.stock': -quantity, stock: -quantity },
                    $set: { updatedAt }
                },
                { session }
            )
            : await productsCollection.updateOne(
                { sku, isActive: { $ne: false }, stock: { $gte: quantity } },
                { $inc: { stock: -quantity }, $set: { updatedAt } },
                { session }
            );

        if (result.matchedCount !== 1) {
            const error = new Error(`Insufficient stock for SKU ${sku}`);
            error.code = 'INSUFFICIENT_STOCK';
            error.sku = sku;
            throw error;
        }

        const updatedProduct = await productsCollection.findOne(
            variantProduct ? { _id: variantProduct._id } : { sku, isActive: { $ne: false } },
            { session, projection: { _id: 1, stock: 1, variants: 1 } }
        );
        const totalStock = Array.isArray(updatedProduct?.variants) && updatedProduct.variants.length
            ? updatedProduct.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0)
            : Math.max(0, Number(updatedProduct?.stock) || 0);
        await productsCollection.updateOne(
            { _id: updatedProduct._id },
            {
                $set: {
                    stock: totalStock,
                    status: totalStock > 0 ? 'C\u00f2n h\u00e0ng' : '\u0048\u1ebft h\u00e0ng',
                    updatedAt
                }
            },
            { session }
        );
    }
}

async function restoreStockBulk(items, session) {
    if (!productsCollection) throw new Error('MongoDB Product collection is not available');
    if (!session) throw new Error('MongoDB stock restoration requires a transaction session');

    const updatedAt = new Date();
    for (const item of items) {
        const sku = String(item.sku || '').trim();
        const quantity = Number(item.quantity);
        if (!sku || !Number.isSafeInteger(quantity) || quantity < 1) {
            throw new Error('Invalid SKU or quantity for stock restoration');
        }

        const variantProduct = await productsCollection.findOne(
            { 'variants.sku': sku },
            { session, projection: { _id: 1 } }
        );
        const result = variantProduct
            ? await productsCollection.updateOne(
                { _id: variantProduct._id, 'variants.sku': sku },
                { $inc: { 'variants.$.stock': quantity } },
                { session }
            )
            : await productsCollection.updateOne(
                { sku },
                { $inc: { stock: quantity } },
                { session }
            );

        if (result.matchedCount !== 1) {
            throw new Error(`Cannot restore stock for missing SKU ${sku}`);
        }

        const updatedProduct = await productsCollection.findOne(
            variantProduct ? { _id: variantProduct._id } : { sku },
            { session, projection: { _id: 1, stock: 1, variants: 1 } }
        );
        const totalStock = Array.isArray(updatedProduct?.variants) && updatedProduct.variants.length
            ? updatedProduct.variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock) || 0), 0)
            : Math.max(0, Number(updatedProduct?.stock) || 0);
        await productsCollection.updateOne(
            { _id: updatedProduct._id },
            {
                $set: {
                    stock: totalStock,
                    status: totalStock > 0 ? 'C\u00f2n h\u00e0ng' : '\u0048\u1ebft h\u00e0ng',
                    updatedAt
                }
            },
            { session }
        );
    }
}

// ProductAssets
function getAllAssets() {
    return productAssetsCollection.find({}).toArray();
}

function getProductAssetsBySku(sku) {
    const baseSku = String(sku || '').split('-')[0].trim();
    if (!baseSku || !productAssetsCollection) return Promise.resolve([]);
    const escapedSku = baseSku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return productAssetsCollection.find({
        $or: [
            { productSku: baseSku },
            { assetId: { $regex: `^${escapedSku}_(?:THUMB|IMG_\\d+)$` } }
        ]
    }, {
        projection: { assetId: 1, productSku: 1, type: 1, originalFileName: 1, mimeType: 1 }
    }).toArray();
}

function getProductAssetsBySkus(skus) {
    const baseSkus = [...new Set((skus || []).map(sku => String(sku || '').split('-')[0].trim()).filter(Boolean))];
    if (!baseSkus.length || !productAssetsCollection) return Promise.resolve([]);
    const canonicalAssetQueries = baseSkus.map(sku => ({
        assetId: { $regex: `^${sku.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}_(?:THUMB|IMG_\\d+)$` }
    }));
    return productAssetsCollection.find({
        $or: [{ productSku: { $in: baseSkus } }, ...canonicalAssetQueries]
    }, {
        projection: { assetId: 1, productSku: 1, type: 1, originalFileName: 1, mimeType: 1 }
    }).toArray();
}

function getAssetsByThumbnails(thumbnails) {
    const ids = thumbnails
        .filter(value => value !== null && value !== undefined)
        .map(String);

    return productAssetsCollection.find({
        $or: [
            { assetId: { $in: ids } },
            { originalFileName: { $in: ids } },
            ...ids
                .filter(id => ObjectId.isValid(id))
                .map(id => ({ _id: new ObjectId(id) }))
        ]
    }, {
        projection: {
            assetId: 1,
            originalFileName: 1,
            mimeType: 1
        }
    }).toArray();
}

function getAssetImageById(id) {
    return productAssetsCollection.findOne(
        { _id: new ObjectId(id) },
        {
            projection: {
                data: 1,
                mimeType: 1
            }
        }
    );
}

function getAssetById(id) {
    return productAssetsCollection.findOne({
        _id: new ObjectId(id)
    });
}

function getByAssetId(assetId) {
    return productAssetsCollection.findOne({ assetId });
}

async function getByFileName(originalFileName) {
    const matches = await productAssetsCollection
        .find({ originalFileName })
        .limit(2)
        .toArray();
    // Old records sometimes store the original filename instead of an assetId.
    // Do not resolve duplicate filenames to an arbitrary product's image.
    return matches.length === 1 ? matches[0] : null;
}

function getApprovedReviewsBySku(sku) {
    return reviewsCollection
        .find(
            { productSku: sku, isApproved: true },
            {
                projection: {
                    productSku: 1,
                    userName: 1,
                    userAvatar: 1,
                    rating: 1,
                    comment: 1,
                    createdAt: 1
                }
            }
        )
        .sort({ createdAt: -1 })
        .toArray();
}

async function createReview(review) {
    const result = await reviewsCollection.insertOne(review);
    return {
        _id: result.insertedId,
        ...review
    };
}

module.exports = {
    setCollections,
    getAll,
    getById,
    getBySku,
    getBySlug,
    incrementSoldBySku,
    decrementSoldBySku,
    getInventoryProducts,
    setStockBySku,
    adjustStockBySku,
    addStockBulk,
    deductStockBulk,
    restoreStockBulk,
    bulkAdjustStock,
    withTransaction,
    getAllAssets,
    getProductAssetsBySku,
    getProductAssetsBySkus,
    getAssetsByThumbnails,
    getAssetImageById,
    getAssetById,
    getByAssetId,
    getByFileName,
    getApprovedReviewsBySku,
    createReview
};
