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

function insertMany(orders) {
    if (!ordersCollection) return Promise.resolve();
    return ordersCollection.insertMany(orders);
}

module.exports = {
    setCollection,
    getAll,
    getById,
    create,
    count,
    insertMany
};
