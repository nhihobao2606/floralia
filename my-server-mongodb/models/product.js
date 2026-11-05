const { ObjectId } = require('mongodb');
const Cart = require('./cart');
const Category = require('./category');
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
    if (products?.s?.db) {
        Cart.setCollection(products.s.db.collection('Cart'));
        Category.setCollection(products.s.db.collection('Categories'));
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
        const thumbnail = product.thumbnail || (assetSkuSet.has(product.sku) ? `${product.sku}_THUMB` : '');
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

function incrementSoldBySku(sku, quantity) {
    if (!productsCollection) return Promise.resolve({ matchedCount: 0 });
    return productsCollection.updateOne(
        { $or: [{ sku }, { 'variants.sku': sku }] },
        { $inc: { sold: quantity } }
    );
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
    getAllAssets,
    getAssetsByThumbnails,
    getAssetImageById,
    getAssetById,
    getByAssetId,
    getByFileName,
    getApprovedReviewsBySku,
    createReview
};
