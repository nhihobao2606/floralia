const Order = require('../models/order');
const Product = require('../models/product');
const ProductSalesService = require('../models/product-sales-service');
const Voucher = require('../models/voucher');
const User = require('../models/user');
const { randomBytes } = require('crypto');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getOrdersForUser(userId) {
  const user = await User.getById(userId);
  if (!user) return [];

  const legacyOrderFilter = user.email
    ? {
        $and: [
          { $or: [{ userId: { $exists: false } }, { userId: null }, { userId: '' }] },
          {
            'receiver.email': {
              $regex: `^${escapeRegex(String(user.email).trim())}$`,
              $options: 'i'
            }
          }
        ]
      }
    : null;
  const filter = legacyOrderFilter
    ? { $or: [{ userId: String(userId) }, legacyOrderFilter] }
    : { userId: String(userId) };

  return Order.getAll(filter);
}

async function belongsToUser(order, userId) {
  if (!order || !userId) return false;
  if (order.userId) return String(order.userId) === String(userId);

  const user = await User.getById(userId);
  const orderEmail = String(order.receiver?.email || '').trim().toLowerCase();
  return Boolean(user?.email && orderEmail && orderEmail === String(user.email).trim().toLowerCase());
}

function getAvailableStock(product, item) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const variant = variants.find(candidate => candidate.sku === item.sku) ||
    (product.sku === item.sku && item.variant
      ? variants.find(candidate => candidate.label === item.variant)
      : null);

  if (variant) {
    return Number(variant.stock);
  }

  if (product.sku === item.sku && variants.length > 0 && item.variant) {
    return 0;
  }

  return Number(product.stock);
}

function parseOrderTimestamp(order) {
  if (order.createdAt) {
    const t = new Date(order.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  if (order.date) {
    const parts = String(order.date).split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      if (order.time) {
        const timeParts = String(order.time).split(':');
        hours = parseInt(timeParts[0], 10) || 0;
        minutes = parseInt(timeParts[1], 10) || 0;
        seconds = parseInt(timeParts[2], 10) || 0;
      }
      const t = new Date(year, month, day, hours, minutes, seconds).getTime();
      if (!isNaN(t)) return t;
    }
    const directTime = new Date(order.date).getTime();
    if (!isNaN(directTime)) return directTime;
  }
  return 0;
}

function sortOrdersNewestFirst(orders) {
  if (!Array.isArray(orders)) return [];
  return [...orders].sort((a, b) => {
    const diff = parseOrderTimestamp(b) - parseOrderTimestamp(a);
    if (diff !== 0) return diff;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

// GET /api/orders
async function getOrders(req, res) {
  try {
    const { status, q } = req.query;
    if (!req.userId) {
      return res.json({ success: true, orders: [] });
    }
    let list = await getOrdersForUser(req.userId);
    list = sortOrdersNewestFirst(list);

    if (status && status !== 'all') {
      if (status === 'waiting') {
        list = list.filter(o => o.status === 'delivered' || o.status === 'waiting');
      } else if (status === 'shipping') {
        list = list.filter(o => o.status === 'shipping' || o.status === 'processing');
      } else {
        list = list.filter(o => o.status === status);
      }
    }

    if (q) {
      const term = q.trim().toLowerCase();
      list = list.filter(o =>
        (o.id && o.id.toLowerCase().includes(term)) ||
        (o.code && o.code.toLowerCase().includes(term)) ||
        (o.items && o.items.some(it => it.name && it.name.toLowerCase().includes(term)))
      );
    }

    res.json({ success: true, orders: list });
  } catch (err) {
    console.error('Lỗi server khi lấy danh sách đơn hàng:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách đơn hàng.' });
  }
}

async function getAdminOrders(req, res) {
  try {
    const orders = sortOrdersNewestFirst(await Order.getAll());
    res.json({ success: true, orders });
  } catch (err) {
    console.error('Lỗi lấy danh sách đơn hàng quản trị:', err);
    res.status(500).json({ success: false, message: 'Không thể lấy danh sách đơn hàng.' });
  }
}

// GET /api/orders/:id
async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const order = id.startsWith('don-hang-')
      ? await Order.getBySlug(id)
      : await Order.getById(id);
    if (!(await belongsToUser(order, req.userId))) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết đơn hàng.' });
  }
}

// POST /api/orders
async function createOrder(req, res) {
  const body = req.body || {};
  const items = body.items;
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.some(item =>
      !item ||
      typeof item.sku !== 'string' ||
      !item.sku.trim() ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1
    )
  ) {
    return res.status(400).json({ success: false, message: 'Thông tin sản phẩm trong đơn hàng không hợp lệ.' });
  }

  const receiver = body.receiver;
  if (
    !receiver ||
    typeof receiver.name !== 'string' || !receiver.name.trim() ||
    typeof receiver.phone !== 'string' || !receiver.phone.trim() ||
    typeof receiver.address !== 'string' || !receiver.address.trim()
  ) {
    return res.status(400).json({
      success: false,
      message: 'Vui lòng nhập họ tên, số điện thoại và địa chỉ nhận hàng.'
    });
  }

  try {
    const itemsBySku = new Map();
    for (const item of items) {
      const sku = item.sku.trim();
      itemsBySku.set(sku, {
        ...item,
        sku,
        quantity: (itemsBySku.get(sku)?.quantity || 0) + item.quantity
      });
    }

    const verifiedItems = [];
    for (const item of itemsBySku.values()) {
      const product = await Product.getBySku(item.sku);
      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Không tìm thấy sản phẩm "${item.name || item.sku}". Vui lòng tải lại giỏ hàng.`
        });
      }

      const variants = Array.isArray(product.variants) ? product.variants : [];
      const variant = variants.find(candidate => candidate.sku === item.sku) ||
        (product.sku === item.sku && item.variant
          ? variants.find(candidate => candidate.label === item.variant)
          : null);
      const availableStock = getAvailableStock(product, item);
      if (!Number.isFinite(availableStock) || item.quantity > availableStock) {
        return res.status(400).json({
          success: false,
          message: availableStock > 0
            ? `Sản phẩm "${item.name || item.sku}" chỉ còn ${availableStock} sản phẩm. Vui lòng cập nhật số lượng.`
            : `Sản phẩm "${item.name || item.sku}" hiện đã hết hàng. Vui lòng xóa sản phẩm này khỏi đơn hàng.`
        });
      }

      const price = Number(variant?.price ?? product.price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({
            success: false,
            message: `Giá sản phẩm "${product.name}" không hợp lệ.`
        });
      }

      verifiedItems.push({
        sku: item.sku,
        slug: product.slug || '',
        name: product.name,
        image: typeof item.image === 'string' ? item.image : '',
        variant: variant?.label || '',
        price,
        quantity: item.quantity,
        total: price * item.quantity
      });
    }

    const subtotal = verifiedItems.reduce((sum, item) => sum + item.total, 0);
    const voucherCode = typeof body.voucherCode === 'string' ? body.voucherCode.trim() : '';
    let discount = 0;
    if (voucherCode) {
      const voucher = await Voucher.getByCode(voucherCode);
      discount = Voucher.calculateDiscount(voucher, subtotal);
      if (discount === null || discount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Mã voucher không hợp lệ hoặc không còn đủ điều kiện áp dụng.'
        });
      }
    }
    const shippingFee = 0;
    const id = randomBytes(16).toString('hex');
    const newOrder = {
      id,
      code: `#${id.slice(-8).toUpperCase()}`,
      slug: `don-hang-${id.slice(-8).toLowerCase()}`,
      date: new Date().toLocaleDateString('vi-VN'),
      time: new Date().toLocaleTimeString('vi-VN'),
      status: 'pending',
      statusLabel: 'CHỜ XÁC NHẬN',
      step: 2,
      paymentMethod: String(body.paymentMethod || 'Thanh toán khi nhận hàng (COD)'),
      sender: body.sender || {},
      receiver: {
        name: receiver.name.trim(),
        address: receiver.address.trim(),
        email: typeof receiver.email === 'string' ? receiver.email.trim() : '',
        phone: receiver.phone.trim()
      },
      items: verifiedItems,
      ...(voucherCode ? { voucherCode } : {}),
      subtotal,
      discount,
      shippingFee,
      total: subtotal - discount + shippingFee,
      ...(req.userId ? { userId: req.userId } : {})
    };
    await Order.create(newOrder);

    const missingSkus = await ProductSalesService.incrementSoldCounts(verifiedItems);
    missingSkus.forEach(sku => {
      console.error(`Không tìm thấy sản phẩm SKU "${sku}" để cập nhật số lượng đã bán.`);
    });

    res.json({ success: true, order: newOrder });
  } catch (err) {
    console.error('Lỗi khi lưu đơn hàng hoặc cập nhật số lượng đã bán:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo đơn hàng.' });
  }
}

// PATCH /api/orders/:id
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const order = await Order.getById(id);
    if (!(await belongsToUser(order, req.userId))) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const { status, cancelReason, cancelReasons, refundReason, refundNote, refundImages } = req.body || {};
    let updateFields;
    if (status === 'cancelled' && ['pending', 'processing', 'shipping'].includes(order.status)) {
      const normalizedCancelReasons = normalizeCancelReasons(cancelReasons, cancelReason);
      if (!normalizedCancelReasons) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn lý do hủy đơn.' });
      }
      updateFields = {
        status,
        statusLabel: 'ĐÃ HỦY',
        cancelReasons: normalizedCancelReasons,
        cancelReason: summarizeCancelReasons(normalizedCancelReasons)
      };
    } else if (status === 'refund_pending' && order.status === 'delivered') {
      if (
        typeof refundReason !== 'string' || !refundReason.trim() ||
        !Array.isArray(refundImages) || refundImages.length > 5 ||
        refundImages.some(image => typeof image !== 'string' || image.length > 2_800_000)
      ) {
        return res.status(400).json({ success: false, message: 'Thông tin yêu cầu hoàn tiền không hợp lệ.' });
      }
      updateFields = {
        status,
        statusLabel: 'CHỜ DUYỆT HOÀN TIỀN',
        refundReason: refundReason.trim(),
        refundNote: typeof refundNote === 'string' ? refundNote.trim() : '',
        refundImages
      };
    } else if (status === 'completed' && order.status === 'delivered') {
      updateFields = { status, statusLabel: 'HOÀN THÀNH', step: 5 };
    } else {
      return res.status(409).json({
        success: false,
        message: 'Trạng thái đơn hàng hiện tại không cho phép thao tác này.'
      });
    }

    const updated = await Order.findOneAndUpdate(
      { id: order.id },
      { $set: updateFields }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Lỗi khi cập nhật trạng thái đơn hàng:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái đơn hàng.' });
  }
}

function normalizeCancelReasons(reasons, legacyReason) {
  if (!Array.isArray(reasons)) {
    if (typeof legacyReason !== 'string' || !legacyReason.trim()) return null;
    return legacyReason
      .split(',')
      .map(reason => ({ reason: reason.trim() }))
      .filter(reason => reason.reason);
  }

  if (
    reasons.length === 0 ||
    reasons.length > 10 ||
    reasons.some(reason =>
      !reason ||
      typeof reason.reason !== 'string' ||
      !reason.reason.trim() ||
      reason.reason.trim().length > 100 ||
      (reason.detail !== undefined && (typeof reason.detail !== 'string' || reason.detail.trim().length > 500)) ||
      (reason.reason.trim() === 'Khác' && (typeof reason.detail !== 'string' || !reason.detail.trim()))
    )
  ) {
    return null;
  }

  return reasons.map(reason => ({
    reason: reason.reason.trim(),
    ...(typeof reason.detail === 'string' && reason.detail.trim() ? { detail: reason.detail.trim() } : {})
  }));
}

function summarizeCancelReasons(reasons) {
  return reasons
    .map(reason => reason.detail ? `${reason.reason}: ${reason.detail}` : reason.reason)
    .join(', ');
}

async function cancelOrderItems(req, res) {
  try {
    const order = await Order.getById(req.params.id);
    if (!(await belongsToUser(order, req.userId))) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }
    if (!['pending', 'processing', 'shipping'].includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: 'Đơn hàng hiện tại không còn cho phép hủy sản phẩm.'
      });
    }

    const { itemIndexes, cancelReason, cancelReasons } = req.body || {};
    const normalizedCancelReasons = normalizeCancelReasons(cancelReasons, cancelReason);
    if (
      !Array.isArray(itemIndexes) ||
      itemIndexes.length === 0 ||
      itemIndexes.some(index => !Number.isSafeInteger(index) || index < 0 || index >= order.items.length) ||
      new Set(itemIndexes).size !== itemIndexes.length ||
      !normalizedCancelReasons
    ) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn sản phẩm và nhập lý do hủy hợp lệ.'
      });
    }

    const selectedIndexes = new Set(itemIndexes);
    const reasonSummary = summarizeCancelReasons(normalizedCancelReasons);
    const cancelledItems = order.items
      .filter((_, index) => selectedIndexes.has(index))
      .map(item => ({
        ...item,
        cancelReason: reasonSummary,
        cancelReasons: normalizedCancelReasons,
        cancelledAt: new Date()
      }));
    const remainingItems = order.items.filter((_, index) => !selectedIndexes.has(index));
    const subtotal = remainingItems.reduce(
      (sum, item) => sum + Number(item.total ?? Number(item.price) * Number(item.quantity)),
      0
    );
    const currentSubtotal = Number(order.subtotal) || 0;
    const discount = remainingItems.length && currentSubtotal > 0
      ? Math.min(subtotal, Math.round((Number(order.discount) || 0) * subtotal / currentSubtotal))
      : 0;
    const shippingFee = remainingItems.length ? Math.max(0, Number(order.shippingFee) || 0) : 0;
    const fullyCancelled = remainingItems.length === 0;
    const previousCancelledItems = Array.isArray(order.cancelledItems) ? order.cancelledItems : [];
    const updateFields = {
      items: remainingItems,
      cancelledItems: [...previousCancelledItems, ...cancelledItems],
      cancelReasons: normalizedCancelReasons,
      cancelReason: reasonSummary,
      subtotal,
      discount,
      shippingFee,
      total: subtotal - discount + shippingFee,
      ...(fullyCancelled ? { status: 'cancelled', statusLabel: 'ĐÃ HỦY' } : {})
    };

    const updated = await Order.findOneAndUpdate(
      { id: order.id, status: order.status, items: order.items },
      { $set: updateFields }
    );
    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Đơn hàng vừa được cập nhật. Vui lòng tải lại trang rồi thử lại.'
      });
    }
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Lỗi khi hủy sản phẩm trong đơn hàng:', err);
    res.status(500).json({ success: false, message: 'Không thể hủy sản phẩm trong đơn hàng.' });
  }
}

async function updateAdminOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const order = await Order.getById(id);
    const nextStatuses = {
      pending: ['processing', 'CHỜ LẤY HÀNG'],
      processing: ['shipping', 'ĐANG GIAO'],
      shipping: ['delivered', 'ĐÃ GIAO']
    };
    const transition = nextStatuses[order?.status];
    if (!order || !transition || transition[0] !== status) {
      return res.status(409).json({ success: false, message: 'Không thể chuyển đơn hàng sang trạng thái này.' });
    }
    const updated = await Order.findOneAndUpdate(
      { id: order.id },
      { $set: { status, statusLabel: transition[1], step: status === 'delivered' ? 5 : status === 'shipping' ? 4 : 3 } }
    );
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Lỗi cập nhật đơn hàng quản trị:', err);
    res.status(500).json({ success: false, message: 'Không thể cập nhật đơn hàng.' });
  }
}

async function approveRefund(req, res) {
  try {
    const { id } = req.params;
    const order = await Order.getById(id);
    if (!order || order.status !== 'refund_pending') {
      return res.status(409).json({ success: false, message: 'Đơn hàng không ở trạng thái chờ duyệt hoàn tiền.' });
    }
    const updated = await Order.findOneAndUpdate(
      { id: order.id, status: 'refund_pending' },
      { $set: { status: 'refund_approved', statusLabel: 'ĐÃ DUYỆT HOÀN TIỀN', refundAmount: order.total } }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Yêu cầu hoàn tiền đã được xử lý.' });
    }
    res.json({ success: true, order: updated });
  } catch (err) {
    console.error('Lỗi duyệt yêu cầu hoàn tiền:', err);
    res.status(500).json({ success: false, message: 'Không thể duyệt yêu cầu hoàn tiền.' });
  }
}

module.exports = {
  getOrders,
  getAdminOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrderItems,
  updateAdminOrderStatus,
  approveRefund
};
