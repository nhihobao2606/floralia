let cartCollection;

function setCollection(collection) {
    cartCollection = collection;
}

async function getByUser(userId) {
    if (!cartCollection || !userId) return null;
    return cartCollection.findOne({ userId: String(userId) });
}

function normalizeItems(items = []) {
    const now = new Date().toISOString();
    return (Array.isArray(items) ? items : []).flatMap(item => {
        if (!item || typeof item !== 'object') return [];
        const productId = String(item.productId || '').trim();
        const variantSku = String(item.variantSku || '').trim();
        const itemSku = String(item.sku || '').trim();
        const productSku = String(item.productSku || (itemSku && itemSku !== variantSku ? itemSku : '')).trim();
        if (!productId && !productSku && !variantSku) return [];
        const addedAt = item.addedAt && !Number.isNaN(new Date(item.addedAt).getTime())
            ? new Date(item.addedAt).toISOString()
            : now;
        return [{
            ...(productId ? { productId } : {}),
            ...(productSku ? { productSku } : {}),
            ...(variantSku ? { variantSku } : {}),
            quantity: Math.min(999, Math.max(1, Math.floor(Number(item.quantity) || 1))),
            addedAt
        }];
    });
}

async function saveByUser(userId, items = []) {
    if (!cartCollection || !userId) return null;
    const normalizedItems = normalizeItems(items);
    const now = new Date();
    return cartCollection.updateOne(
        { userId: String(userId) },
        {
            $set: {
                items: normalizedItems,
                updatedAt: now
            },
            $setOnInsert: {
                userId: String(userId),
                createdAt: now
            },
            $unset: { email: '', fullName: '' }
        },
        { upsert: true }
    );
}

module.exports = {
    setCollection,
    getByUser,
    saveByUser,
    normalizeItems
};

