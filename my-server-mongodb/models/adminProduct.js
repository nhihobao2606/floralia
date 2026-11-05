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

async function syncProductAssetsSku(product) {
    if (!productAssetsCollection || !product?.sku) return;
    const baseSku = String(product.sku).split('-')[0].trim();
    if (!baseSku) return;

    const rawIds = [
        product.thumbnail,
        ...(Array.isArray(product.images) ? product.images : [])
    ].filter(Boolean).map(String);

    const objectIds = rawIds
        .filter(id => ObjectId.isValid(id) && id.length === 24)
        .map(id => new ObjectId(id));

    if (objectIds.length > 0) {
        await productAssetsCollection.updateMany(
            { _id: { $in: objectIds } },
            { $set: { productSku: baseSku } }
        );
    }

    const exists = await productAssetsCollection.findOne({ productSku: baseSku }, { projection: { _id: 1 } });
    if (!exists) {
        await productAssetsCollection.insertOne({
            productSku: baseSku,
            assetId: `${baseSku}_META`,
            originalFileName: `${baseSku}_META`,
            mimeType: 'image/svg+xml',
            data: '',
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
}

async function backfillAllProductsAssetSkus() {
    if (!productsCollection || !productAssetsCollection) return;
    try {
        const products = await productsCollection.find({}).project({ sku: 1, thumbnail: 1, images: 1 }).toArray();
        for (const product of products) {
            await syncProductAssetsSku(product);
        }
    } catch (err) {
        console.error('Không thể đồng bộ productSku cho ProductAssets:', err);
    }
}

function setCollections(products, assets) {
    productsCollection = products;
    productAssetsCollection = assets;
    if (products?.s?.db) {
        Cart.setCollection(products.s.db.collection('Cart'));
        Category.setCollection(products.s.db.collection('Categories'));
    }
    void backfillAllProductsAssetSkus();
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
    const created = { _id: result.insertedId, ...product };
    await syncProductAssetsSku(created);
    return created;
}

async function update(id, product) {
    const result = await productsCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: product },
        { returnDocument: 'after' }
    );
    const updated = result?.value ?? result;
    if (updated) {
        await syncProductAssetsSku(updated);
    }
    return updated;
}

async function remove(id) {
    return productsCollection.deleteOne({ _id: new ObjectId(id) });
}

async function updateMany(filter, updateDoc) {
    if (!productsCollection) return;
    return productsCollection.updateMany(filter, updateDoc);
}

async function insertImages(images, productSku = '') {
    const baseSku = productSku ? String(productSku).split('-')[0].trim() : '';
    const assets = images.map(image => ({
        data: image.data,
        mimeType: image.mimeType,
        originalFileName: image.fileName,
        assetId: `product-${new ObjectId().toString()}`,
        ...(baseSku ? { productSku: baseSku } : {}),
        createdAt: new Date(),
        updatedAt: new Date()
    }));
    if (!assets.length) return [];
    const result = await productAssetsCollection.insertMany(assets);
    return assets.map((asset, index) => String(result.insertedIds[index]));
}

module.exports = { setCollections, getAll, getById, getBySku, create, update, updateMany, remove, insertImages, productEvents, notifyProductChanged, getVersion };
