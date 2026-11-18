const { ObjectId } = require('mongodb');

let ordersCollection;

function setCollection(collection) {
    ordersCollection = collection;
}

function getIdFilter(id) {
    const rawId = String(id || '').trim();
    const withoutHash = rawId.startsWith('#') ? rawId.substring(1) : rawId;
    const withHash = '#' + withoutHash;
    const conditions = [
        { id: rawId },
        { id: withoutHash },
        { code: rawId },
        { code: withHash },
        { code: withoutHash },
        { orderCode: rawId },
        { orderCode: withHash }
    ];
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
        conditions.push({ _id: new ObjectId(id) });
    }
    return { $or: conditions };
}

function getAll(filter = {}, options = {}) {
    if (!ordersCollection) return Promise.resolve([]);
    let cursor = ordersCollection.find(filter);
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.skip) cursor = cursor.skip(options.skip);
    if (options.limit) cursor = cursor.limit(options.limit);
    return cursor.toArray();
}

function getRecommendationHistory(limit = 3000) {
    if (!ordersCollection) return Promise.resolve([]);
    return ordersCollection.find(
        { isDemo: { $ne: true } },
        { projection: {
            userId: 1,
            'receiver.email': 1,
            status: 1,
            createdAt: 1,
            total: 1,
            'items.sku': 1,
            'items.quantity': 1,
            'items.category': 1,
            'items.categorySlug': 1
        } }
    ).sort({ createdAt: -1 }).limit(limit).maxTimeMS(10000).toArray();
}

function getDemandHistory(fromDate) {
    if (!ordersCollection) return Promise.resolve([]);
    return ordersCollection.find({
        isDemo: { $ne: true },
        status: { $in: ['pending', 'processing', 'shipping', 'delivered', 'completed'] },
        $or: [
            { createdAt: { $gte: fromDate } },
            { createdAt: { $gte: fromDate.toISOString() } }
        ]
    }, { projection: {
        status: 1,
        createdAt: 1,
        'items.sku': 1,
        'items.quantity': 1,
        'items.salePrice': 1,
        'items.price': 1
    } }).sort({ createdAt: 1 }).maxTimeMS(12000).toArray();
}

function getById(id) {
    if (!ordersCollection) return Promise.resolve(null);
    return ordersCollection.findOne(getIdFilter(id));
}

function getBySlug(slug) {
    if (!ordersCollection) return Promise.resolve(null);
    const identifier = String(slug).replace(/^don-hang-/, '');
    const upperIdentifier = identifier.toUpperCase();
    return ordersCollection.findOne({
        $or: [
            { slug: String(slug) },
            { id: identifier },
            { id: upperIdentifier },
            { code: identifier },
            { code: `#${identifier}` },
            { code: upperIdentifier },
            { code: `#${upperIdentifier}` }
        ]
    });
}

function create(order, options = {}) {
    if (!ordersCollection) {
        throw new Error('Orders collection has not been initialized.');
    }
    return ordersCollection.insertOne({
        ...order,
        createdAt: order.createdAt || new Date()
    }, options);
}

function count(filter = {}) {
    if (!ordersCollection) return Promise.resolve(0);
    return ordersCollection.countDocuments(filter);
}

function insertMany(orders) {
    if (!ordersCollection) return Promise.resolve();
    return ordersCollection.insertMany(orders);
}

function findOneAndUpdate(filter, update, options = {}) {
    if (!ordersCollection) return Promise.resolve(null);
    return ordersCollection.findOneAndUpdate(filter, update, { returnDocument: 'after', ...options });
}

function updateOne(filter, update, options = {}) {
    if (!ordersCollection) return Promise.resolve(null);
    return ordersCollection.updateOne(filter, update, options);
}

function deleteOne(filter) {
    if (!ordersCollection) return Promise.resolve({ deletedCount: 0 });
    return ordersCollection.deleteOne(filter);
}

function deleteMany(filter) {
    if (!ordersCollection) return Promise.resolve({ deletedCount: 0 });
    return ordersCollection.deleteMany(filter);
}

function aggregate(pipeline = []) {
    if (!ordersCollection) return Promise.resolve([]);
    return ordersCollection.aggregate(pipeline).toArray();
}

module.exports = {
    setCollection,
    getIdFilter,
    getAll,
    getRecommendationHistory,
    getDemandHistory,
    getById,
    getBySlug,
    create,
    count,
    insertMany,
    findOneAndUpdate,
    updateOne,
    deleteOne,
    deleteMany,
    aggregate
};
