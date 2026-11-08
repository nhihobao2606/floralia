let cartCollection;

function setCollection(collection) {
    cartCollection = collection;
}

async function getByUser(userId, email = '') {
    if (!cartCollection || !userId) return null;
    const conditions = [{ userId: String(userId) }];
    if (email) {
        conditions.push({ email: String(email).trim().toLowerCase() });
    }
    return cartCollection.findOne({ $or: conditions });
}

async function saveByUser(userId, userMeta = {}, items = []) {
    if (!cartCollection || !userId) return null;
    const normalizedItems = Array.isArray(items) ? items : [];
    const now = new Date();
    return cartCollection.updateOne(
        { userId: String(userId) },
        {
            $set: {
                userId: String(userId),
                email: String(userMeta.email || '').trim().toLowerCase(),
                fullName: String(userMeta.fullName || '').trim(),
                items: normalizedItems,
                updatedAt: now
            },
            $setOnInsert: {
                createdAt: now
            }
        },
        { upsert: true }
    );
}

module.exports = {
    setCollection,
    getByUser,
    saveByUser
};

