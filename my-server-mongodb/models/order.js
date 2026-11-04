const { ObjectId } = require('mongodb');

let ordersCollection;

function setCollection(collection) {
    ordersCollection = collection;
}

function getIdFilter(id) {
    const conditions = [{ id: String(id) }, { code: String(id) }, { code: `#${id}` }];
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
        conditions.push({ _id: new ObjectId(id) });
    }
    return { $or: conditions };
}

function getAll(filter = {}, options = {}) {
    if (!ordersCollection) return Promise.resolve([]);
    let cursor = ordersCollection.find(filter);
    if (options.sort) cursor = cursor.sort(options.sort);
    if (options.limit) cursor = cursor.limit(options.limit);
    return cursor.toArray();
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

function create(order) {
    if (!ordersCollection) {
        throw new Error('Orders collection has not been initialized.');
    }
    return ordersCollection.insertOne({
        ...order,
        createdAt: order.createdAt || new Date()
    });
}

function count() {
    if (!ordersCollection) return Promise.resolve(0);
    return ordersCollection.countDocuments();
}

function findOneAndUpdate(filter, update, options = {}) {
    if (!ordersCollection) return Promise.resolve(null);
    return ordersCollection.findOneAndUpdate(filter, update, { returnDocument: 'after', ...options });
}

module.exports = {
    setCollection,
    getAll,
    getById,
    getBySlug,
    create,
    count,
    findOneAndUpdate
};
