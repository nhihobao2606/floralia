const { ObjectId } = require('mongodb');
const { EventEmitter } = require('events');
const Cart = require('./cart');
const Category = require('./category');

let productsCollection;
let productAssetsCollection;
const productEvents = new EventEmitter();
productEvents.setMaxListeners(100);
let lastUpdatedVersion = Date.now();

function notifyProductChanged(action = 'updated', productId = null) {
    lastUpdatedVersion = Date.now();
    productEvents.emit('changed', {
        version: lastUpdatedVersion,
        action,
        productId: productId ? String(productId) : null
    });
}

function getVersion() {
    return lastUpdatedVersion;
}

function setCollections(products, assets) {
    productsCollection = products;
    productAssetsCollection = assets;
    if (products?.s?.db) {
        Cart.setCollection(products.s.db.collection('Cart'));
        Category.setCollection(products.s.db.collection('Categories'));
    }
}

async function getAll() {
    return productsCollection.find({}).sort({ createdAt: -1, name: 1 }).toArray();
}

async function getById(id) {
    if (!ObjectId.isValid(id)) return null;
    return productsCollection.findOne({ _id: new ObjectId(id) });
}

async function getBySku(sku, exceptId) {
    const filter = { sku };
    if (exceptId && ObjectId.isValid(exceptId)) filter._id = { $ne: new ObjectId(exceptId) };
    return productsCollection.findOne(filter, { projection: { _id: 1 } });
}

async function create(product) {
    const result = await productsCollection.insertOne(product);
    return { _id: result.insertedId, ...product };
}

async function update(id, product) {
    const result = await productsCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: product },
        { returnDocument: 'after' }
    );
    return result?.value ?? result;
}

async function remove(id) {
    return productsCollection.deleteOne({ _id: new ObjectId(id) });
}

async function updateMany(filter, updateDoc) {
    if (!productsCollection) return;
    return productsCollection.updateMany(filter, updateDoc);
}

async function insertImages(images) {
    const assets = images.map(image => ({
        data: image.data,
        mimeType: image.mimeType,
        originalFileName: image.fileName,
        assetId: `product-${new ObjectId().toString()}`,
        createdAt: new Date(),
        updatedAt: new Date()
    }));
    if (!assets.length) return [];
    const result = await productAssetsCollection.insertMany(assets);
    return assets.map((asset, index) => String(result.insertedIds[index]));
}

module.exports = { setCollections, getAll, getById, getBySku, create, update, updateMany, remove, insertImages, productEvents, notifyProductChanged, getVersion };
