let blogsCollection;

function setCollection(collection) {
    blogsCollection = collection;
}

function find(filter) {
    return blogsCollection.find(filter);
}

function countDocuments(filter) {
    return blogsCollection.countDocuments(filter);
}

function findOne(filter) {
    return blogsCollection.findOne(filter);
}

function aggregate(pipeline) {
    return blogsCollection.aggregate(pipeline);
}

function insertOne(document) {
    return blogsCollection.insertOne(document);
}

function findOneAndUpdate(filter, update, options) {
    return blogsCollection.findOneAndUpdate(filter, update, options);
}

function updateOne(filter, update, options) {
    return blogsCollection.updateOne(filter, update, options);
}

function deleteOne(filter) {
    return blogsCollection.deleteOne(filter);
}

module.exports = {
    setCollection,
    find,
    countDocuments,
    findOne,
    aggregate,
    insertOne,
    findOneAndUpdate,
    updateOne,
    deleteOne
};
