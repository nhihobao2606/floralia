const Voucher = require('../models/voucher');
const Order = require('../models/order');
const Product = require('../models/product');

function serializeVoucher(voucher) {
    const now = new Date();
    let status = voucher.status || ((voucher.isActive === false || voucher.active === false) ? 'paused' : 'active');
    if (status === 'active' && (voucher.isActive === false || voucher.active === false)) status = 'paused';
    const endDate = voucher.endDate ?? voucher.expiresAt;
    const startDate = voucher.startDate ?? voucher.startsAt;
    if (status === 'active' && endDate && new Date(endDate) < now) status = 'expired';
    else if (status === 'active' && startDate && new Date(startDate) > now) status = 'upcoming';
    return {
        ...voucher,
        id: voucher._id?.toString() || voucher.id || voucher.code,
        discountType: ['fixed', 'amount'].includes(String(voucher.discountType || voucher.type || '').toLowerCase()) ? 'fixed' : 'percent',
        discountValue: Number(voucher.discountValue ?? voucher.value ?? 0),
        maxDiscount: voucher.maxDiscount ?? voucher.maximumDiscount ?? null,
        minOrderValue: Number(voucher.minOrderValue ?? voucher.minimumOrder ?? 0),
        startDate: startDate || null,
        endDate: endDate || null,
        categories: Array.isArray(voucher.categories) ? voucher.categories : [],
        productIds: Array.isArray(voucher.productIds) ? voucher.productIds : [],
        usedCount: Number(voucher.usedCount || 0),
        usageLimit: Number(voucher.usageLimit || 0),
        perUserLimit: Number(voucher.perUserLimit || 0),
        status,
        isActive: voucher.isActive !== false && status !== 'paused' && status !== 'draft',
    };
}

function validateVoucherInput(body) {
    const code = String(body.code || '').trim().toUpperCase();
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const discountType = String(body.discountType || 'percent').toLowerCase();
    const discountValue = Number(body.discountValue);
    const maxDiscount = body.maxDiscount === '' || body.maxDiscount == null ? null : Number(body.maxDiscount);
    const minOrderValue = Number(body.minOrderValue || 0);
    const usageLimit = Number(body.usageLimit || 0);
    const perUserLimit = Number(body.perUserLimit || 0);
    const startDate = body.startDate ? new Date(body.startDate) : null;
    const endDate = body.endDate ? new Date(body.endDate) : null;
    const scope = String(body.scope || 'all');
    const audience = String(body.audience || 'all');
    const status = String(body.status || 'active');

    if (!/^[A-Z0-9_-]{4,24}$/.test(code)) return { error: 'Mã voucher cần dài 4–24 ký tự, chỉ gồm chữ, số, gạch ngang hoặc gạch dưới.' };
    if (!name || name.length > 120) return { error: 'Vui lòng nhập tên chương trình (tối đa 120 ký tự).' };
    if (!['percent', 'fixed'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || (discountType === 'percent' && discountValue > 100)) {
        return { error: 'Mức giảm giá không hợp lệ.' };
    }
    if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0)) return { error: 'Mức giảm tối đa không hợp lệ.' };
    if (!Number.isFinite(minOrderValue) || minOrderValue < 0 || !Number.isInteger(usageLimit) || usageLimit < 0 || !Number.isInteger(perUserLimit) || perUserLimit < 0) {
        return { error: 'Điều kiện đơn hàng và giới hạn sử dụng phải là số hợp lệ.' };
    }
    if ((startDate && !Number.isFinite(startDate.getTime())) || (endDate && !Number.isFinite(endDate.getTime())) || (startDate && endDate && startDate > endDate)) {
        return { error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' };
    }
    if (!['all', 'categories', 'products'].includes(scope) || !['all', 'new_customer'].includes(audience) || !['active', 'paused', 'draft'].includes(status)) {
        return { error: 'Phạm vi, đối tượng hoặc trạng thái voucher không hợp lệ.' };
    }
    const categories = [...new Set((Array.isArray(body.categories) ? body.categories : []).map(value => String(value).trim()).filter(Boolean))];
    const productIds = [...new Set((Array.isArray(body.productIds) ? body.productIds : []).map(value => String(value).trim()).filter(Boolean))];
    if (scope === 'categories' && !categories.length) return { error: 'Hãy chọn ít nhất một danh mục áp dụng.' };
    if (scope === 'products' && !productIds.length) return { error: 'Hãy nhập ít nhất một mã sản phẩm áp dụng.' };

    return {
        value: {
            code, name, description, discountType, discountValue,
            maxDiscount: discountType === 'percent' ? maxDiscount : null,
            minOrderValue, usageLimit, usedCount: 0, perUserLimit,
            startDate: startDate ? startDate.toISOString() : null,
            endDate: endDate ? endDate.toISOString() : null,
            scope, categories, productIds, audience, status,
            isActive: status === 'active',
        }
    };
}

async function getAdminVouchers(req, res) {
    try {
        const orders = await Order.getAll();
        const vouchers = (await Voucher.getAll()).map(voucher => {
            const uses = orders.filter(order => String(order.voucherCode || '').toUpperCase() === String(voucher.code).toUpperCase()).length;
            return serializeVoucher({ ...voucher, usedCount: Math.max(Number(voucher.usedCount || 0), uses) });
        });
        const month = new Date();
        const monthlyUsage = orders.filter(order => {
            const date = order.createdAt ? new Date(order.createdAt) : null;
            return order.voucherCode && date && date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
        }).length;
        res.json({
            success: true,
            vouchers,
            summary: {
                total: vouchers.length,
                active: vouchers.filter(voucher => voucher.status === 'active').length,
                upcoming: vouchers.filter(voucher => voucher.status === 'upcoming').length,
                paused: vouchers.filter(voucher => voucher.status === 'paused').length,
                expired: vouchers.filter(voucher => voucher.status === 'expired').length,
                monthlyUsage,
            }
        });
    } catch (error) {
        console.error('Lỗi lấy danh sách voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể tải danh sách voucher.' });
    }
}

async function getAdminVoucher(req, res) {
    try {
        const voucher = await Voucher.getById(req.params.id);
        if (!voucher) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        const orders = (await Order.getAll()).filter(order => String(order.voucherCode || '').toUpperCase() === String(voucher.code).toUpperCase());
        res.json({ success: true, voucher: serializeVoucher({ ...voucher, usedCount: Math.max(Number(voucher.usedCount || 0), orders.length) }), orders });
    } catch (error) {
        console.error('Lỗi lấy chi tiết voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể tải chi tiết voucher.' });
    }
}

async function createAdminVoucher(req, res) {
    try {
        const { value, error } = validateVoucherInput(req.body || {});
        if (error) return res.status(400).json({ success: false, message: error });
        if (await Voucher.getByCode(value.code)) return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại.' });
        const now = new Date();
        const voucher = await Voucher.create({ ...value, createdAt: now, updatedAt: now, createdBy: String(req.userId) });
        res.status(201).json({ success: true, message: 'Đã tạo voucher.', voucher: serializeVoucher(voucher) });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại.' });
        console.error('Lỗi tạo voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể tạo voucher.' });
    }
}

async function updateAdminVoucher(req, res) {
    try {
        const existing = await Voucher.getById(req.params.id);
        if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        const { value, error } = validateVoucherInput(req.body || {});
        if (error) return res.status(400).json({ success: false, message: error });
        const conflict = await Voucher.getByCode(value.code);
        if (conflict && String(conflict._id) !== String(existing._id)) return res.status(409).json({ success: false, message: 'Mã voucher đã tồn tại.' });
        value.usedCount = Number(existing.usedCount || 0);
        value.createdAt = existing.createdAt || new Date();
        value.createdBy = existing.createdBy;
        const updated = await Voucher.update(req.params.id, value);
        res.json({ success: true, message: 'Đã cập nhật voucher.', voucher: serializeVoucher(updated) });
    } catch (error) {
        console.error('Lỗi cập nhật voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể cập nhật voucher.' });
    }
}

async function setAdminVoucherStatus(req, res) {
    try {
        const status = req.body?.status === 'active' ? 'active' : 'paused';
        const updated = await Voucher.update(req.params.id, { status, isActive: status === 'active' });
        if (!updated) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        res.json({ success: true, message: status === 'active' ? 'Đã kích hoạt voucher.' : 'Đã tạm dừng voucher.', voucher: serializeVoucher(updated) });
    } catch (error) {
        console.error('Lỗi cập nhật trạng thái voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể cập nhật trạng thái voucher.' });
    }
}

async function deleteAdminVoucher(req, res) {
    try {
        const voucher = await Voucher.getById(req.params.id);
        if (!voucher) return res.status(404).json({ success: false, message: 'Không tìm thấy voucher.' });
        const uses = await Order.getAll({ voucherCode: voucher.code });
        if (Number(voucher.usedCount || 0) > 0 || uses.length) return res.status(409).json({ success: false, message: 'Voucher đã được sử dụng nên không thể xóa. Hãy tạm dừng voucher.' });
        await Voucher.remove(req.params.id);
        res.json({ success: true, message: 'Đã xóa voucher.' });
    } catch (error) {
        console.error('Lỗi xóa voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể xóa voucher.' });
    }
}

async function getVoucherItems(requestedItems) {
    const items = [];
    for (const requestedItem of requestedItems) {
        if (!requestedItem || typeof requestedItem !== 'object') continue;
        const quantity = Number(requestedItem.quantity);
        if (!requestedItem.sku || !Number.isInteger(quantity) || quantity <= 0) continue;
        const product = await Product.getBySku(String(requestedItem.sku));
        if (!product) continue;
        const variants = Array.isArray(product.variants) ? product.variants : [];
        const variant = variants.find(candidate => candidate.sku === requestedItem.sku) ||
            (product.sku === requestedItem.sku && requestedItem.variant
                ? variants.find(candidate => candidate.label === requestedItem.variant)
                : null);
        const price = Number(variant?.price ?? product.price);
        if (!Number.isFinite(price) || price < 0) continue;
        items.push({
            sku: requestedItem.sku,
            slug: product.slug || '',
            productId: product._id?.toString() || '',
            category: product.category || '',
            categorySlug: product.categorySlug || '',
            total: price * quantity,
        });
    }
    return items;
}

async function getAvailableVouchers(req, res) {
    const subtotal = Number(req.body?.subtotal);
    const requestedItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!Number.isFinite(subtotal) || subtotal <= 0) {
        return res.status(400).json({ success: false, message: 'Giá trị đơn hàng không hợp lệ.' });
    }

    try {
        const [vouchers, items, userOrders] = await Promise.all([
            Voucher.getAll(),
            getVoucherItems(requestedItems),
            req.userId ? Order.getAll({ userId: String(req.userId) }) : Promise.resolve([])
        ]);
        const available = vouchers.flatMap(voucher => {
            const details = serializeVoucher(voucher);
            if (!details.isActive || details.status !== 'active') return [];
            if (Voucher.getUserEligibilityError(voucher, userOrders, Boolean(req.userId))) return [];

            const discount = Voucher.calculateDiscount(voucher, subtotal, items);
            if (!discount || discount <= 0) return [];
            return [{
                code: voucher.code,
                name: voucher.name,
                description: voucher.description || '',
                discountType: details.discountType,
                discountValue: details.discountValue,
                maxDiscount: details.maxDiscount,
                minOrderValue: details.minOrderValue,
                endDate: details.endDate,
                discount
            }];
        });
        return res.json({ success: true, vouchers: available });
    } catch (error) {
        console.error('Lỗi lấy danh sách voucher áp dụng:', error);
        return res.status(500).json({ success: false, message: 'Không thể tải danh sách voucher.' });
    }
}

async function validateVoucher(req, res) {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
    const subtotal = Number(req.body?.subtotal);
    if (!code || !Number.isFinite(subtotal) || subtotal <= 0) {
        return res.status(400).json({ success: false, message: 'Mã voucher hoặc giá trị đơn hàng không hợp lệ.' });
    }

    try {
        const voucher = await Voucher.getByCode(code);
        const items = [];
        if (voucher && voucher.scope && voucher.scope !== 'all') {
            if (!Array.isArray(req.body?.items) || req.body.items.length === 0) {
                return res.status(400).json({ success: false, message: 'Vui lòng tải lại giỏ hàng để kiểm tra phạm vi voucher.' });
            }
            items.push(...await getVoucherItems(req.body.items));
        }
        if (voucher && req.userId) {
            const userOrders = await Order.getAll({ userId: req.userId });
            const eligibilityError = Voucher.getUserEligibilityError(voucher, userOrders, Boolean(req.userId));
            if (eligibilityError) return res.status(400).json({ success: false, message: eligibilityError });
        }
        const discount = Voucher.calculateDiscount(voucher, subtotal, items);
        if (discount === null || discount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Mã voucher không hợp lệ, chưa đến hạn, đã hết hạn hoặc chưa đủ điều kiện.'
            });
        }

        res.json({
            success: true,
            voucher: { code: voucher.code, discount }
        });
    } catch (error) {
        console.error('Lỗi kiểm tra voucher:', error);
        res.status(500).json({ success: false, message: 'Không thể kiểm tra voucher từ MongoDB.' });
    }
}

module.exports = {
    getAvailableVouchers,
    validateVoucher,
    getAdminVouchers,
    getAdminVoucher,
    createAdminVoucher,
    updateAdminVoucher,
    setAdminVoucherStatus,
    deleteAdminVoucher,
};
