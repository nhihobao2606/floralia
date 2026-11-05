const Order = require('../models/order');
const Product = require('../models/product');
const ProductSalesService = require('../models/product-sales-service');
const User = require('../models/user');
const Voucher = require('../models/voucher');
const { randomBytes } = require('crypto');
const { ObjectId } = require('mongodb');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getOrdersForUser(userId, status, query, userEmail) {
  const filters = [];
  const emailOrderFilter = userEmail
    ? {
        'receiver.email': {
          $regex: `^${escapeRegex(String(userEmail).trim())}$`,
          $options: 'i'
        }
      }
    : null;
  const userIdMatches = [{ userId: String(userId) }];
  if (typeof userId === 'string' && ObjectId.isValid(userId) && userId.length === 24) {
    userIdMatches.push({ userId: new ObjectId(userId) });
  }
  const orderOwnerMatches = [
    ...userIdMatches,
    { userId: { $exists: false } },
    { userId: null },
    { userId: '' }
  ];
  if (emailOrderFilter) {
    orderOwnerMatches.push(emailOrderFilter);
  }
  if (status && status !== 'all') {
    const statuses = status === 'shipping'
      ? ['shipping', 'delivered', 'waiting']
      : status === 'completed'
        ? ['completed']
        : status === 'refunded'
          ? ['refunded', 'refund_pending', 'refund_approved']
          : [status];
    filters.push({ status: { $in: statuses } });
  }

  const search = String(query || '').trim();
  if (search) {
    const term = new RegExp(escapeRegex(search), 'i');
    filters.push({
      $or: [
        { id: term },
        { code: term },
        { 'items.name': term }
      ]
    });
  }

  return Order.getAll(
    { $and: [{ $or: orderOwnerMatches }, ...filters] },
    { sort: { createdAt: -1 } }
  );
}

function belongsToUser(order, userId) {
  return Boolean(order?.userId && userId && String(order.userId) === String(userId));
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
    const list = await getOrdersForUser(req.userId, status, q);
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

async function getAdminOrdersForUser(req, res) {
  try {
    const user = await User.getById(req.params.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    }
    const orders = sortOrdersNewestFirst(await getOrdersForUser(
      user._id?.toString() || String(user.id),
      undefined,
      undefined,
      user.email
    ));
    return res.json({ success: true, orders });
  } catch (err) {
    console.error('Lỗi lấy lịch sử đơn hàng người dùng:', err);
    return res.status(500).json({ success: false, message: 'Không thể tải lịch sử đơn hàng.' });
  }
}

// GET /api/orders/:id
async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    const order = id.startsWith('don-hang-')
      ? await Order.getBySlug(id)
      : await Order.getById(id);
    if (!order || (order.userId && !(await belongsToUser(order, req.userId))) || (!order.userId && !req.userId)) {
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

    const orderItems = [...itemsBySku.values()];
    const products = await Promise.all(orderItems.map(item => Product.getBySku(item.sku)));
    const verifiedItems = [];
    for (const [index, item] of orderItems.entries()) {
      const product = products[index];
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

      const salePrice = Number(variant?.price ?? product.price);
      const originalPrice = Math.max(
        salePrice,
        Number(variant?.oldPrice ?? product.oldPrice ?? salePrice)
      );
      if (!Number.isFinite(salePrice) || salePrice < 0 || !Number.isFinite(originalPrice)) {
        return res.status(400).json({
            success: false,
            message: `Giá sản phẩm "${product.name}" không hợp lệ.`
        });
      }

      verifiedItems.push({
        sku: item.sku,
        slug: product.slug || '',
        productId: product._id?.toString() || '',
        category: product.category || '',
        categorySlug: product.categorySlug || '',
        name: product.name,
        image: typeof item.image === 'string' ? item.image : '',
        variant: variant?.label || '',
        price: originalPrice,
        oldPrice: originalPrice,
        salePrice,
        productDiscount: (originalPrice - salePrice) * item.quantity,
        quantity: item.quantity,
        total: originalPrice * item.quantity
      });
    }

    const subtotal = verifiedItems.reduce((sum, item) => sum + item.total, 0);
    const productDiscount = verifiedItems.reduce((sum, item) => sum + item.productDiscount, 0);
    const saleSubtotal = Math.max(0, subtotal - productDiscount);
    const voucherCode = typeof body.voucherCode === 'string' ? body.voucherCode.trim() : '';
    let voucherDiscount = 0;
    if (voucherCode) {
      const voucher = await Voucher.getByCode(voucherCode);
      const voucherItems = verifiedItems.map(item => ({
        ...item,
        total: (Number(item.salePrice) || 0) * item.quantity
      }));
      voucherDiscount = Voucher.calculateDiscount(voucher, saleSubtotal, voucherItems);
      if (voucherDiscount === null || voucherDiscount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Mã voucher không hợp lệ hoặc không còn đủ điều kiện áp dụng.'
        });
      }
    }
    const discount = Math.min(subtotal, productDiscount + voucherDiscount);
    const shippingFee = 30_000;
    const id = randomBytes(16).toString('hex');
    const createdAt = new Date();
    const statusNotice = 'Đơn hàng đang chờ cửa hàng xác nhận';
    const newOrder = {
      id,
      code: `#${id.slice(-8).toUpperCase()}`,
      slug: `don-hang-${id.slice(-8).toLowerCase()}`,
      date: createdAt.toLocaleDateString('vi-VN'),
      time: createdAt.toLocaleTimeString('vi-VN'),
      createdAt,
      status: 'pending',
      statusLabel: 'CHỜ XÁC NHẬN',
      step: 1,
      paymentStatus: 'unpaid',
      paymentStatusLabel: 'Chưa thanh toán',
      paymentMethod: String(body.paymentMethod || 'Thanh toán khi nhận hàng (COD)'),
      ...(voucherCode ? { voucherCode, voucherDiscount } : {}),
      sender: body.sender || {},
      receiver: {
        name: receiver.name.trim(),
        address: receiver.address.trim(),
        email: typeof receiver.email === 'string' ? receiver.email.trim() : '',
        phone: receiver.phone.trim()
      },
      items: verifiedItems,
      notice: statusNotice,
      trackingTimeline: [{
        status: 'pending',
        statusLabel: 'CHỜ XÁC NHẬN',
        notice: statusNotice,
        createdAt
      }],
      notes: [],
      ...(typeof body.customerNote === 'string' && body.customerNote.trim()
        ? { customerNote: body.customerNote.trim() }
        : {}),
      subtotal,
      productDiscount,
      discount,
      shippingFee,
      total: subtotal - discount + shippingFee,
      ...(req.userId ? { userId: String(req.userId) } : {})
    };
    await Order.create(newOrder);
    res.json({ success: true, order: newOrder });

    const postSaveUpdates = [ProductSalesService.incrementSoldCounts(verifiedItems)];
    if (voucherCode) postSaveUpdates.push(Voucher.incrementUsed(voucherCode));
    Promise.all(postSaveUpdates)
      .then(([missingSkus]) => {
        missingSkus.forEach(sku => {
          console.error(`Không tìm thấy sản phẩm SKU "${sku}" để cập nhật số lượng đã bán.`);
        });
      })
      .catch(error => {
        console.error('Không thể cập nhật thống kê sau khi lưu đơn hàng:', error);
      });
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
    const { status, cancelReason, cancelReasons, refundReason, refundNote, refundImages } = req.body || {};
    const canCancelSharedDemo = Boolean(
      order && !order.userId && ['pending', 'processing'].includes(order.status) && status === 'cancelled' && req.userId
    );
    const canCompleteSharedDemo = Boolean(
      order && !order.userId && order.status === 'delivered' && status === 'completed' && req.userId
    );
    if (!(await belongsToUser(order, req.userId)) && !canCancelSharedDemo && !canCompleteSharedDemo) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    let updateFields;
    if (status === 'cancelled' && ['pending', 'processing'].includes(order.status)) {
      const normalizedCancelReasons = normalizeCancelReasons(cancelReasons, cancelReason);
      if (!normalizedCancelReasons) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn lý do hủy đơn.' });
      }
      updateFields = {
        status,
        statusLabel: 'ĐÃ HỦY',
        notice: 'Đơn hàng đã được hủy',
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
    reasons.length > 1 ||
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
  getAdminOrdersForUser,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateAdminOrderStatus,
  approveRefund
};
