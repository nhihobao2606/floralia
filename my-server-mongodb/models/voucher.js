const { ObjectId } = require('mongodb');

let vouchersCollection;

function setCollection(collection) {
    vouchersCollection = collection;
}

async function getByCode(code) {
    if (!vouchersCollection) {
        throw new Error('Voucher collection is not connected to MongoDB.');
    }

    return vouchersCollection.findOne({
        code: { $regex: `^${String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
}

function getIdFilter(id) {
    if (typeof id === 'string' && ObjectId.isValid(id) && id.length === 24) {
        return { _id: new ObjectId(id) };
    }
    return { code: String(id).toUpperCase() };
}

async function getAll() {
    if (!vouchersCollection) throw new Error('Voucher collection is not connected to MongoDB.');
    return vouchersCollection.find({}).sort({ createdAt: -1, code: 1 }).toArray();
}

async function getById(id) {
    if (!vouchersCollection) throw new Error('Voucher collection is not connected to MongoDB.');
    return vouchersCollection.findOne(getIdFilter(id));
}

async function create(voucher) {
    if (!vouchersCollection) throw new Error('Voucher collection is not connected to MongoDB.');
    const result = await vouchersCollection.insertOne(voucher);
    return { ...voucher, _id: result.insertedId };
}

async function update(id, data) {
    if (!vouchersCollection) throw new Error('Voucher collection is not connected to MongoDB.');
    return vouchersCollection.findOneAndUpdate(
        getIdFilter(id),
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: 'after' }
    );
}

async function remove(id) {
    if (!vouchersCollection) throw new Error('Voucher collection is not connected to MongoDB.');
    return vouchersCollection.findOneAndDelete(getIdFilter(id));
}

async function incrementUsed(code) {
    if (!vouchersCollection) throw new Error('Voucher collection is not connected to MongoDB.');
    return vouchersCollection.updateOne(
        { code: { $regex: `^${String(code).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } },
        { $inc: { usedCount: 1 }, $set: { updatedAt: new Date() } }
    );
}

function calculateDiscount(voucher, subtotal, items = []) {
    if (!voucher || voucher.isActive === false || voucher.active === false || ['paused', 'draft', 'expired'].includes(voucher.status)) return null;

    const now = new Date();
    const startsAtValue = voucher.startDate ?? voucher.startsAt;
    const expiresAtValue = voucher.endDate ?? voucher.expiresAt;
    const startsAt = startsAtValue ? new Date(startsAtValue) : null;
    const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
    if (
        (startsAt && (!Number.isFinite(startsAt.getTime()) || startsAt > now)) ||
        (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt < now))
    ) {
        return null;
    }

    const usageLimit = Number(voucher.usageLimit || 0);
    if (usageLimit > 0 && Number(voucher.usedCount || 0) >= usageLimit) return null;

    const minimumOrder = Number(voucher.minOrderValue ?? voucher.minimumOrder ?? 0);
    if (!Number.isFinite(minimumOrder) || subtotal < minimumOrder) return null;

    const rawScope = String(voucher.scope || 'all').toLowerCase();
    const scope = rawScope === 'category' ? 'categories' : rawScope === 'product' ? 'products' : rawScope;
    let eligibleSubtotal = subtotal;
    if (scope === 'categories') {
        const categories = new Set((voucher.categories || []).map(value => String(value).toLowerCase()));
        eligibleSubtotal = items.filter(item => categories.has(String(item.category || '').toLowerCase()) || categories.has(String(item.categorySlug || '').toLowerCase()))
            .reduce((sum, item) => sum + Number(item.total || 0), 0);
    } else if (scope === 'products') {
        const products = new Set((voucher.productIds || []).map(String));
        eligibleSubtotal = items.filter(item => products.has(String(item.sku)) || products.has(String(item.slug)) || products.has(String(item.productId)))
            .reduce((sum, item) => sum + Number(item.total || 0), 0);
    }
    if (eligibleSubtotal <= 0) return null;

    const type = String(voucher.discountType || voucher.type || '').toLowerCase();
    const value = Number(voucher.discountValue ?? voucher.value);
    if (!Number.isFinite(value) || value <= 0) return null;

    let discount;
    if (type === 'percentage' || type === 'percent') {
        if (value > 100) return null;
        discount = Math.round(eligibleSubtotal * value / 100);
    } else if (type === 'fixed' || type === 'amount') {
        discount = Math.floor(value);
    } else {
        return null;
    }

    const maximumDiscount = Number(voucher.maxDiscount ?? voucher.maximumDiscount ?? 0);
    if (maximumDiscount > 0) discount = Math.min(discount, maximumDiscount);
    return Math.min(eligibleSubtotal, discount);
}

function getUserEligibilityError(voucher, userOrders = [], isAuthenticated = false) {
    const perUserLimit = Number(voucher?.perUserLimit || 0);
    if (!isAuthenticated && (voucher?.audience === 'new_customer' || perUserLimit > 0)) {
        return 'Vui lòng đăng nhập để sử dụng voucher này.';
    }

    if (voucher?.audience === 'new_customer' && userOrders.length > 0) {
        return 'Voucher này chỉ dành cho khách hàng mới.';
    }

    if (perUserLimit > 0) {
        const uses = userOrders.filter(order =>
            String(order.voucherCode || '').toUpperCase() === String(voucher.code || '').toUpperCase()
        ).length;
        if (uses >= perUserLimit) return 'Bạn đã sử dụng hết số lượt cho phép của voucher này.';
    }

    return null;
}

module.exports = {
    setCollection,
    getByCode,
    getAll,
    getById,
    create,
    update,
    remove,
    incrementUsed,
    calculateDiscount,
    getUserEligibilityError
};
