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

function getAll(filter = {}) {
    if (!ordersCollection) return Promise.resolve([]);
    return ordersCollection.find(filter).toArray();
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
    if (!ordersCollection) return Promise.resolve({ insertedId: null });
    return ordersCollection.insertOne({
        ...order,
        createdAt: new Date()
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
