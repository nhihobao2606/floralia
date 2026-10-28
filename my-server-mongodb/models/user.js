let usersCollection;

function setCollection(collection) {
    usersCollection = collection;
}

function findByEmail(email) {
    return usersCollection.findOne({ email });
}

function exists(email) {
    return usersCollection.findOne({ email }, { projection: { _id: 1 } });
}

function create(user) {
    return usersCollection.insertOne(user);
}

function getById(id) {
    return usersCollection.findOne({ _id: id });
}

module.exports = {
    setCollection,
    findByEmail,
    exists,
    create,
    getById
};