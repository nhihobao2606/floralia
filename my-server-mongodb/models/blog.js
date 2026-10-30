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

function findOneAndUpdate(filter, update, options) {
    return blogsCollection.findOneAndUpdate(filter, update, options);
}

module.exports = {
    setCollection,
    find,
    countDocuments,
    findOneAndUpdate
};
