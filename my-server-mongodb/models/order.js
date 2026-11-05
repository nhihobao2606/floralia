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

function getById(id) {
    if (!ordersCollection) return Promise.resolve(null);
    return ordersCollection.findOne(getIdFilter(id));
}

function create(order) {
    if (!ordersCollection) return Promise.resolve({ insertedId: null });
    return ordersCollection.insertOne({
        ...order,
        createdAt: order.createdAt || new Date()
    });
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
    getById,
    create,
    count,
    insertMany,
    findOneAndUpdate,
    updateOne,
    deleteOne,
    deleteMany,
    aggregate
};
