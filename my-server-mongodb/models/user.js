const { ObjectId } = require('mongodb');

let usersCollection;

function setCollection(collection) {
    usersCollection = collection;
}

function getIdFilter(id) {
    if (!id) return { _id: id };
    if (id instanceof ObjectId) return { _id: id };
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
        return { _id: new ObjectId(id) };
    }
    return { _id: id };
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
    const filter = getIdFilter(id);
    return usersCollection.findOne(filter);
}

function update(id, data) {
    const filter = getIdFilter(id);
    return usersCollection.updateOne(
        filter,
        { $set: { ...data, updatedAt: new Date() } }
    );
}

function updatePassword(id, hashedPassword) {
    const filter = getIdFilter(id);
    return usersCollection.updateOne(
        filter,
        { $set: { password: hashedPassword, updatedAt: new Date() } }
    );
}

function setPasswordResetToken(email, tokenHash, expiresAt) {
    return usersCollection.updateOne(
        { email },
        { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } }
    );
}

function clearPasswordResetToken(tokenHash) {
    return usersCollection.updateOne(
        { passwordResetTokenHash: tokenHash },
        { $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' } }
    );
}

function updatePasswordWithResetToken(tokenHash, now, hashedPassword) {
    return usersCollection.updateOne(
        { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: now } },
        {
            $set: { password: hashedPassword, updatedAt: now },
            $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' }
        }
    );
}

module.exports = {
    setCollection,
    findByEmail,
    exists,
    create,
    getById,
    update,
    updatePassword,
    setPasswordResetToken,
    clearPasswordResetToken,
    updatePasswordWithResetToken
};
