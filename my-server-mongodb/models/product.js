const { ObjectId } = require('mongodb');

let productsCollection;
let productAssetsCollection;
let reviewsCollection;

function setCollections(products, productAssets, reviews) {
    productsCollection = products;
    productAssetsCollection = productAssets;
    reviewsCollection = reviews;
}

// Products
async function getAll() {
    const products = await productsCollection.find({}).toArray();
    const productSkus = products
        .map(product => product.sku)
        .filter(sku => typeof sku === 'string' && sku.length > 0);
    const ratingSummaries = productSkus.length
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
        return {
            ...product,
            ratingAverage: summary?.ratingAverage ?? 0,
            ratingCount: summary?.ratingCount ?? 0
        };
    });
}

function getById(id) {
    return productsCollection.findOne({
        _id: new ObjectId(id)
    });
}

function getBySku(sku) {
    return productsCollection.findOne({
        $or: [
            { sku },
            { 'variants.sku': sku }
        ]
    });
}

function getBySlug(slug) {
    return productsCollection.findOne({ slug });
}

function incrementSoldBySku(sku, quantity) {
    return productsCollection.updateOne(
        { $or: [{ sku }, { 'variants.sku': sku }] },
        { $inc: { sold: quantity } }
    );
}

// ProductAssets
function getAllAssets() {
    return productAssetsCollection.find({}).toArray();
}

// Chỉ lấy ảnh được sản phẩm sử dụng
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