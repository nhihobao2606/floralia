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

function calculateDiscount(voucher, subtotal) {
    if (!voucher || voucher.isActive === false || voucher.active === false) return null;

    const now = new Date();
    const startsAt = voucher.startsAt ? new Date(voucher.startsAt) : null;
    const expiresAt = voucher.expiresAt ? new Date(voucher.expiresAt) : null;
    if (
        (startsAt && (!Number.isFinite(startsAt.getTime()) || startsAt > now)) ||
        (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt < now))
    ) {
        return null;
    }

    const minimumOrder = Number(voucher.minimumOrder || 0);
    if (!Number.isFinite(minimumOrder) || subtotal < minimumOrder) return null;

    const type = String(voucher.discountType || voucher.type || '').toLowerCase();
    const value = Number(voucher.discountValue ?? voucher.value);
    if (!Number.isFinite(value) || value <= 0) return null;

    let discount;
    if (type === 'percentage' || type === 'percent') {
        if (value > 100) return null;
        discount = Math.round(subtotal * value / 100);
    } else if (type === 'fixed' || type === 'amount') {
        discount = Math.floor(value);
    } else {
        return null;
    }

    const maximumDiscount = Number(voucher.maximumDiscount || 0);
    if (maximumDiscount > 0) discount = Math.min(discount, maximumDiscount);
    return Math.min(subtotal, discount);
}

module.exports = { setCollection, getByCode, calculateDiscount };
