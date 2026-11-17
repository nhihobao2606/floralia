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

}

async function backfillAllProductsAssetSkus() {
    if (!productsCollection || !productAssetsCollection) return;
    try {
        const products = await productsCollection.find({}).project({ sku: 1, thumbnail: 1, images: 1 }).toArray();
        for (const product of products) {
            await syncProductAssetsSku(product);
        }
        await productAssetsCollection.deleteMany({
            assetId: { $regex: /_META$/ },
            type: { $exists: false },
            mimeType: 'image/svg+xml',
            data: ''
        });
        await cleanupOrphanProductAssets();
    } catch (err) {
        console.error('Không thể đồng bộ productSku cho ProductAssets:', err);
    }
}

async function cleanupOrphanProductAssets() {
    if (!productsCollection || !productAssetsCollection) return;
    const products = await productsCollection.find({}).project({ sku: 1 }).toArray();
    // An empty catalog can be a first-run/import state; do not sweep its assets.
    if (!products.length) return;
    const activeSkus = products.map(product => String(product.sku || '').split('-')[0].trim()).filter(Boolean);
    const assets = await productAssetsCollection.find({ assetId: { $exists: true } }).project({ _id: 1, assetId: 1, productSku: 1 }).toArray();
    const orphanIds = assets.filter(asset => {
        const assetId = String(asset.assetId || '');
        const belongsToActiveSku = activeSkus.some(sku =>
            assetId.startsWith(`${sku}_THUMB`) || assetId.startsWith(`${sku}_IMG_`)
        );
        const storedSku = String(asset.productSku || '').split('-')[0].trim();
        return !belongsToActiveSku && (!storedSku || !activeSkus.includes(storedSku));
    }).map(asset => asset._id);
    if (orphanIds.length) await productAssetsCollection.deleteMany({ _id: { $in: orphanIds } });
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
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
        const found = await productsCollection.findOne({ _id: new ObjectId(id) });
        if (found) return found;
    }
    return productsCollection.findOne({ sku: id });
}

async function getByIds(ids) {
    if (!Array.isArray(ids) || !ids.length) return [];
    return productsCollection.find({ _id: { $in: ids.map(id => new ObjectId(id)) } }).toArray();
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

async function removeMany(ids) {
    return productsCollection.deleteMany({ _id: { $in: ids.map(id => new ObjectId(id)) } });
}

async function updateMany(filter, updateDoc) {
    if (!productsCollection) return;
    return productsCollection.updateMany(filter, updateDoc);
}

async function insertImages(images, productSku = '', options = {}) {
    if (!Array.isArray(images) || images.length === 0) return [];
    if (!productAssetsCollection) throw new Error('ProductAssets collection has not been initialized.');

    const baseSku = productSku ? String(productSku).split('-')[0].trim() : '';
    const createThumbnail = Boolean(options.createThumbnail);
    let imageIndex = Math.max(0, Number(options.imageStartIndex) || 0);
    const reservedAssetIds = new Set();
    const assets = [];
    for (let index = 0; index < images.length; index++) {
        const image = images[index];
        const isThumbnail = createThumbnail && index === 0;
        if (isThumbnail) {
            assets.push({
                _id: new ObjectId(),
                assetId: `${baseSku}_THUMB`,
                productSku: baseSku,
                originalFileName: image.fileName,
                type: 'thumbnail',
                mimeType: 'image/webp',
                data: image.data
            });
            // Keep IMG_1 as the canonical image copy of the representative photo.
            imageIndex = 1;
            const imageId = `${baseSku}_IMG_${imageIndex}`;
            assets.push({
                _id: new ObjectId(),
                assetId: imageId,
                productSku: baseSku,
                originalFileName: image.fileName,
                type: 'image',
                mimeType: 'image/webp',
                data: image.data
            });
            reservedAssetIds.add(imageId);
            continue;
        }
        imageIndex += 1;
        const assetId = `${baseSku}_IMG_${imageIndex}`;
        if (reservedAssetIds.has(assetId)) throw new Error(`Duplicate product image index: ${assetId}`);
        reservedAssetIds.add(assetId);
        assets.push({
            _id: new ObjectId(),
            assetId,
            productSku: baseSku,
            originalFileName: image.fileName,
            type: 'image',
            mimeType: 'image/webp',
            data: image.data
        });
    }
    const assetIds = assets.map(asset => asset.assetId);
    await productAssetsCollection.deleteMany({ assetId: { $in: assetIds } });
    await productAssetsCollection.insertMany(assets);
    return assets.map(asset => asset.assetId);
}

async function pruneProductAssets(productSku, references = []) {
    if (!productAssetsCollection || !productSku) return;
    const baseSku = String(productSku).split('-')[0].trim();
    const retainedIds = [...new Set((references || []).filter(Boolean).map(String))];
    const filter = { productSku: baseSku };
    if (retainedIds.length) filter.assetId = { $nin: retainedIds };
    await productAssetsCollection.deleteMany(filter);
}

async function removeProductAssetsBySkus(productSkus = []) {
    if (!productAssetsCollection) return { deletedCount: 0 };
    const baseSkus = [...new Set(productSkus.map(sku => String(sku || '').split('-')[0].trim()).filter(Boolean))];
    if (!baseSkus.length) return { deletedCount: 0 };
    const assetIdPatterns = baseSkus.map(sku => ({
        assetId: { $regex: `^${sku.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}_(?:THUMB|IMG_\\d+)(?:_\\d+)?$` }
    }));
    return productAssetsCollection.deleteMany({
        $or: [
            { productSku: { $in: baseSkus } },
            ...assetIdPatterns
        ]
    });
}

async function getAssetsByReferences(references) {
    if (!productAssetsCollection) return [];
    const ids = [...new Set((references || []).filter(Boolean).map(String))];
    if (!ids.length) return [];
    const conditions = [
        { assetId: { $in: ids } },
        { originalFileName: { $in: ids } }
    ];
    for (const id of ids) {
        if (ObjectId.isValid(id) && id.length === 24) {
            conditions.push({ _id: new ObjectId(id) });
        }
    }
    return productAssetsCollection.find({ $or: conditions }).project({
        assetId: 1,
        originalFileName: 1
    }).toArray();
}

async function getProductAssetsBySku(productSku) {
    if (!productAssetsCollection || !productSku) return [];
    const baseSku = String(productSku).split('-')[0].trim();
    return productAssetsCollection.find({ productSku: baseSku }).project({
        assetId: 1,
        productSku: 1,
        originalFileName: 1,
        type: 1,
        mimeType: 1
    }).toArray();
}

module.exports = { setCollections, getAll, getById, getByIds, getBySku, create, update, updateMany, remove, removeMany, insertImages, pruneProductAssets, removeProductAssetsBySkus, getAssetsByReferences, getProductAssetsBySku, productEvents, notifyProductChanged, getVersion };
