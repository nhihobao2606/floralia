const { ObjectId } = require('mongodb');

let productsCollection;
let productAssetsCollection;

function setCollections(products, productAssets) {
    productsCollection = products;
    productAssetsCollection = productAssets;
}

// Products
function getAll() {
    return productsCollection.find({}).toArray();
}

function getById(id) {
    return productsCollection.findOne({
        _id: new ObjectId(id)
    });
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

module.exports = {
    setCollections,
    getAll,
    getById,
    getAllAssets,
    getAssetsByThumbnails,
    getAssetImageById,
    getAssetById,
    getByAssetId,
    getByFileName
};