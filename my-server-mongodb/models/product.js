const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');

let productsCollection;
let productAssetsCollection;
let reviewsCollection;

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

function setCollections(products, productAssets, reviews) {
    productsCollection = products;
    productAssetsCollection = productAssets;
    reviewsCollection = reviews;
}

// Products - sourced & verified against MongoDB ProductAssets
async function getAll() {
    if (!productAssetsCollection) {
        return [];
    }

    // 1. Get all authentic product SKUs directly from MongoDB ProductAssets
    const assetSkus = await productAssetsCollection.distinct('productSku');
    if (!Array.isArray(assetSkus) || assetSkus.length === 0) {
        return [];
    }

    // 2. Fetch products matching authentic SKUs from MongoDB Product collection if available
    let products = [];
    if (productsCollection) {
        products = await productsCollection.find({
            sku: { $in: assetSkus },
            isActive: { $ne: false }
        }).toArray();
    }

    // If MongoDB collection is empty or missing items, fill from official catalog
    if (products.length === 0) {
        const catalog = getLocalCatalog();
        products = catalog.filter(p => assetSkus.includes(p.sku) && p.isActive !== false);
    } else {
        const foundSkus = new Set(products.map(p => p.sku));
        const catalog = getLocalCatalog();
        for (const item of catalog) {
            if (assetSkus.includes(item.sku) && !foundSkus.has(item.sku) && item.isActive !== false) {
                products.push(item);
            }
        }
    }

    // 3. Attach ratings from MongoDB Reviews collection
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
        const thumbnail = product.thumbnail || `${product.sku}_THUMB`;
        return {
            ...product,
            thumbnail,
            ratingAverage: summary?.ratingAverage ?? (product.ratingAverage || 5),
            ratingCount: summary?.ratingCount ?? (product.ratingCount || 0)
        };
    });
}

async function getById(id) {
    if (!id || !productAssetsCollection) return null;

    let product = null;
    if (productsCollection && ObjectId.isValid(id)) {
        product = await productsCollection.findOne({ _id: new ObjectId(id) });
    }
    if (!product) {
        const catalog = getLocalCatalog();
        product = catalog.find(p => String(p._id) === String(id) || p.sku === id) || null;
    }

    if (product) {
        const baseSku = String(product.sku).split('-')[0].trim();
        const assetExists = await productAssetsCollection.findOne({ productSku: baseSku });
        if (!assetExists) return null;
    }

    return product;
}

async function getBySku(sku) {
    if (!sku || !productAssetsCollection) return null;
    const baseSku = String(sku).split('-')[0].trim();

    // Verify SKU belongs to authentic assets in MongoDB ProductAssets
    const assetExists = await productAssetsCollection.findOne({ productSku: baseSku });
    if (!assetExists) {
        return null;
    }

    let product = null;
    if (productsCollection) {
        product = await productsCollection.findOne({
            $or: [
                { sku },
                { 'variants.sku': sku },
                { sku: baseSku }
            ]
        });
    }

    if (!product) {
        const catalog = getLocalCatalog();
        product = catalog.find(p =>
            p.sku === sku ||
            p.sku === baseSku ||
            (Array.isArray(p.variants) && p.variants.some(v => v.sku === sku))
        ) || null;
    }

    return product;
}

async function getBySlug(slug) {
    if (!slug || !productAssetsCollection) return null;

    let product = null;
    if (productsCollection) {
        product = await productsCollection.findOne({ slug });
    }
    if (!product) {
        const catalog = getLocalCatalog();
        product = catalog.find(p => p.slug === slug) || null;
    }

    if (product) {
        const baseSku = String(product.sku).split('-')[0].trim();
        const assetExists = await productAssetsCollection.findOne({ productSku: baseSku });
        if (!assetExists) return null;
    }

    return product;
}

function getBySlug(slug) {
    return productsCollection.findOne({ slug });
}

function incrementSoldBySku(sku, quantity) {
    if (!productsCollection) return Promise.resolve({ matchedCount: 0 });
    return productsCollection.updateOne(
        { $or: [{ sku }, { 'variants.sku': sku }] },
        { $inc: { sold: quantity } }
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

// ProductAssets
function getAllAssets() {
    return productAssetsCollection.find({}).toArray();
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

function getByFileName(originalFileName) {
    return productAssetsCollection.findOne({ originalFileName });
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
    getInventoryProducts,
    setStockBySku,
    addStockBulk,
    getAllAssets,
    getAssetsByThumbnails,
    getAssetImageById,
    getAssetById,
    getByAssetId,
    getByFileName,
    getApprovedReviewsBySku,
    createReview
};
