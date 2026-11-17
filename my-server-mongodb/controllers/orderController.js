const Order = require('../models/order');
const Product = require('../models/product');
const ProductSalesService = require('../models/product-sales-service');
const { cancelOrderAndRestoreStock } = require('../models/order-cancellation-service');
const AdminProduct = require('../models/adminProduct');
const User = require('../models/user');
const Voucher = require('../models/voucher');
const { randomBytes, createHash, timingSafeEqual } = require('crypto');
const { ObjectId } = require('mongodb');

const GUEST_TRACKING_ACTIVE_STATUSES = new Set(['pending', 'processing', 'waiting', 'shipping']);
const GUEST_OTP_TTL_MS = 5 * 60 * 1000;
const GUEST_OTP_COOLDOWN_MS = 60 * 1000;
const GUEST_OTP_MAX_ATTEMPTS = 5;
const guestTrackingChallenges = new Map();
const guestOtpCooldowns = new Map();
const guestOrderActions = new Map();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getOrdersForUser(userId, status, query) {
  // Demo orders are shared; all other orders belong only to their exact userId.
  // Receiver email is contact information and never establishes ownership.
  const userIdMatches = [{ userId: String(userId) }];
  if (typeof userId === 'string' && ObjectId.isValid(userId) && userId.length === 24) {
    userIdMatches.push({ userId: new ObjectId(userId) });
  }
  const orderOwnerMatches = [...userIdMatches, { isDemo: true }];
  const filters = [];

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
  ).then(orders => orders.filter(order =>
    order.isDemo || (
      !order.guestOrder && !isLegacyDemoOrder(order) &&
      userIdMatches.some(condition => String(order.userId) === String(condition.userId))
    )
  ));
}

function belongsToUser(order, userId) {
  return Boolean(order?.userId && userId && String(order.userId) === String(userId));
}

function canReplayOrderForRequester(order, req) {
  return req.userId
    ? belongsToUser(order, req.userId)
    : Boolean(order?.guestOrder && !order.userId);
}

function isLegacyDemoOrder(order) {
  return /^#?FL00\d+$/i.test(String(order?.id || order?.code || ''));
}

function normalizeVietnamPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const local = digits.startsWith('84') ? `0${digits.slice(2)}` : digits;
  return /^(0)(3|5|7|8|9)\d{8}$/.test(local) ? local : null;
}

function isActiveGuestOrder(order) {
  return order && GUEST_TRACKING_ACTIVE_STATUSES.has(String(order.status || '').toLowerCase());
}

function publicGuestTrackingOrder(order) {
  return {
    id: order.id,
    code: order.code || order.orderCode || order.id,
    status: order.status,
    statusLabel: order.statusLabel,
    createdAt: order.createdAt,
    date: order.date,
    time: order.time,
    paymentMethod: order.paymentMethod || '',
    shippingUnit: order.shippingUnit || '',
    trackingCode: order.trackingCode || '',
    trackingTimeline: Array.isArray(order.trackingTimeline) ? order.trackingTimeline : [],
    notice: order.notice || '',
    receiver: {
      name: order.receiver?.name || '',
      phone: order.receiver?.phone || '',
      email: order.receiver?.email || '',
      address: order.receiver?.address || ''
    },
    subtotal: Number(order.subtotal || 0),
    productDiscount: Number(order.productDiscount ?? order.discount ?? 0),
    voucherDiscount: Number(order.voucherDiscount || 0),
    voucherCode: order.voucherCode || '',
    shippingFee: Number(order.shippingFee || 0),
    total: Number(order.total || 0),
    items: (order.items || []).map(item => ({
      sku: item.sku || '',
      name: item.name,
      quantity: item.quantity,
      image: item.image || '',
      variant: item.variant || '',
      price: Number(item.salePrice ?? item.price ?? item.oldPrice ?? 0),
      oldPrice: Number(item.oldPrice || 0),
      total: Number(item.total ?? ((item.salePrice ?? item.price ?? item.oldPrice ?? 0) * item.quantity) ?? 0)
    }))
  };
}

function normalizeOrderLookup(value) {
  return String(value || '').trim().replace(/^#/, '').toLowerCase();
}

async function findActiveGuestOrders(query) {
  const phone = normalizeVietnamPhone(query);
  if (phone) {
    const international = `84${phone.slice(1)}`;
    const orders = await Order.getAll({
      status: { $in: [...GUEST_TRACKING_ACTIVE_STATUSES] },
      userId: { $in: [null, ''] },
      'receiver.phone': { $in: [phone, `+${international}`, international] }
    }, { sort: { createdAt: -1 } });
    return orders.filter(order => normalizeVietnamPhone(order.receiver?.phone) === phone);
  }

  const lookup = normalizeOrderLookup(query);
  if (!lookup || lookup.length > 80) return [];
  const upperLookup = lookup.toUpperCase();
  const codeVariants = [...new Set([lookup, upperLookup, `#${lookup}`, `#${upperLookup}`])];
  const idVariants = [...new Set([lookup, upperLookup])];
  const orders = await Order.getAll({
    status: { $in: [...GUEST_TRACKING_ACTIVE_STATUSES] },
    userId: { $in: [null, ''] },
    $or: [
      { code: { $in: codeVariants } },
      { orderCode: { $in: codeVariants } },
      { id: { $in: idVariants } }
    ]
  }, { limit: 10 });
  return orders.filter(isActiveGuestOrder);
}

async function sendGuestTrackingOtp(phone, otp) {
  const mode = String(process.env.SMS_OTP_MODE || '').toLowerCase();
  if (process.env.NODE_ENV !== 'production' && (mode === 'console' || !mode)) {
    console.error(`[DEMO OTP] Tra cứu đơn — gửi tới ***${phone.slice(-4)} — mã: ${otp}`);
    return;
  }
  throw new Error('SMS OTP delivery is not configured. Set SMS_OTP_MODE=console for local demo or configure an SMS provider.');
}

function maskPhone(phone) {
  return `${phone.slice(0, 3)}****${phone.slice(-3)}`;
}

function pruneGuestOtpState(now = Date.now()) {
  for (const [key, challenge] of guestTrackingChallenges) {
    if (challenge.expiresAt <= now) guestTrackingChallenges.delete(key);
  }
  for (const [key, cooldownUntil] of guestOtpCooldowns) {
    if (cooldownUntil <= now) guestOtpCooldowns.delete(key);
  }
  for (const [key, access] of guestOrderActions) {
    if (access.expiresAt <= now) guestOrderActions.delete(key);
  }
}

async function requestGuestTrackingOtp(req, res) {
  try {
    const query = String(req.body?.query || '').trim();
    if (!query || query.length > 80) {
      return res.status(400).json({ success: false, message: 'Nhập số điện thoại hoặc mã đơn hợp lệ.' });
    }
    const lookupType = normalizeVietnamPhone(query) ? 'phone' : 'order-code';
    console.error(`[Guest order tracking] OTP request received (lookup: ${lookupType}).`);
    const matches = await findActiveGuestOrders(query);
    const phone = normalizeVietnamPhone(matches[0]?.receiver?.phone);
    // Keep the response neutral so the endpoint cannot be used to enumerate orders.
    if (!phone || !matches.length) {
      console.error(`[Guest order tracking] No active guest order matched (${lookupType}); OTP not sent.`);
      return res.json({
        success: true,
        flowVersion: 'guest-tracking-otp-v2',
        challengeId: null,
        phoneHint: '',
        expiresInSeconds: 0
      });
    }

    const now = Date.now();
    pruneGuestOtpState(now);
    if ((guestOtpCooldowns.get(phone) || 0) > now) {
      console.error(`[Guest order tracking] OTP cooldown active for ***${phone.slice(-4)}.`);
      return res.json({
        success: true,
        flowVersion: 'guest-tracking-otp-v2',
        reason: 'cooldown',
        challengeId: null,
        phoneHint: '',
        expiresInSeconds: 0
      });
    }

    const otp = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, '0');
    const challengeId = randomBytes(24).toString('hex');
    await sendGuestTrackingOtp(phone, otp);
    console.error(`[Guest order tracking] Demo OTP issued for ***${phone.slice(-4)}.`);
    guestTrackingChallenges.set(challengeId, {
      phone,
      query: normalizeVietnamPhone(query) ? null : normalizeOrderLookup(query),
      otpHash: createHash('sha256').update(`${challengeId}:${otp}`).digest('hex'),
      attempts: 0,
      expiresAt: now + GUEST_OTP_TTL_MS
    });
    guestOtpCooldowns.set(phone, now + GUEST_OTP_COOLDOWN_MS);
    return res.json({
      success: true,
      flowVersion: 'guest-tracking-otp-v2',
      challengeId,
      phoneHint: maskPhone(phone),
      expiresInSeconds: GUEST_OTP_TTL_MS / 1000
    });
  } catch (error) {
    console.error('Không thể gửi OTP tra cứu đơn hàng:', error.message);
    const status = error.message.includes('not configured') ? 503 : 500;
    return res.status(status).json({
      success: false,
      message: status === 503 ? 'Dịch vụ gửi SMS OTP chưa được cấu hình.' : 'Không thể gửi mã OTP lúc này.'
    });
  }
}

async function verifyGuestTrackingOtp(req, res) {
  try {
    const challengeId = String(req.body?.challengeId || '');
    const otp = String(req.body?.otp || '').trim();
    const now = Date.now();
    pruneGuestOtpState(now);
    const challenge = guestTrackingChallenges.get(challengeId);
    if (!challenge || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
    }
    challenge.attempts++;
    const candidate = createHash('sha256').update(`${challengeId}:${otp}`).digest('hex');
    const valid = candidate.length === challenge.otpHash.length &&
      timingSafeEqual(Buffer.from(candidate), Buffer.from(challenge.otpHash));
    if (!valid) {
      if (challenge.attempts >= GUEST_OTP_MAX_ATTEMPTS) guestTrackingChallenges.delete(challengeId);
      return res.status(400).json({ success: false, message: 'Mã OTP không chính xác.' });
    }

    guestTrackingChallenges.delete(challengeId);
    const orders = await findActiveGuestOrders(challenge.query || challenge.phone);
    const ownedOrders = orders.filter(order =>
      !order.userId && normalizeVietnamPhone(order.receiver?.phone) === challenge.phone
    );
    const guestAccessToken = ownedOrders.length ? randomBytes(32).toString('hex') : null;
    if (guestAccessToken) {
      guestOrderActions.set(guestAccessToken, {
        orderIds: new Set(ownedOrders.map(order => String(order.id))),
        expiresAt: now + 30 * 60 * 1000
      });
    }
    return res.json({
      success: true,
      flowVersion: 'guest-tracking-otp-v2',
      guestAccessToken,
      orders: ownedOrders.map(publicGuestTrackingOrder)
    });
  } catch (error) {
    console.error('Không thể xác thực OTP tra cứu đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Không thể xác thực mã OTP lúc này.' });
  }
}

async function cancelGuestOrder(req, res) {
  try {
    const id = String(req.params.id || '');
    const accessToken = String(req.get('x-guest-order-token') || '');
    const access = guestOrderActions.get(accessToken);
    if (!accessToken || !access || access.expiresAt <= Date.now() || !access.orderIds.has(id)) {
      if (accessToken && access?.expiresAt <= Date.now()) guestOrderActions.delete(accessToken);
      return res.status(403).json({ success: false, message: 'Phiên xác minh đã hết hạn. Vui lòng xác minh OTP lại.' });
    }

    const cancelReasons = normalizeCancelReasons(req.body?.cancelReasons, req.body?.cancelReason);
    if (!cancelReasons) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn lý do hủy đơn.' });
    }

    const updated = await Order.findOneAndUpdate(
      {
        id,
        guestOrder: true,
        userId: { $in: [null, ''] },
        status: { $in: ['pending', 'processing', 'waiting'] }
      },
      { $set: {
        status: 'cancelled',
        statusLabel: 'Đã hủy',
        notice: 'Đơn hàng đã được hủy',
        cancelReasons,
        cancelReason: summarizeCancelReasons(cancelReasons)
      } }
    );
    if (!updated) {
      return res.status(409).json({ success: false, message: 'Đơn không còn ở trạng thái có thể hủy hoặc đã được cập nhật. Vui lòng tải lại trang.' });
    }
    return res.json({ success: true, order: publicGuestTrackingOrder(updated) });
  } catch (error) {
    console.error('Không thể hủy đơn guest:', error);
    return res.status(500).json({ success: false, message: 'Không thể hủy đơn hàng lúc này. Vui lòng thử lại.' });
  }
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

function normalizeClientOrder(order) {
  if (!order) return order;
  const status = order.status === 'waiting' ? 'processing' : order.status;
  const shippingUnit = order.shippingUnit || '';
  const trackingCode = order.trackingCode || '';
  const labels = {
    pending: 'Chờ xác nhận', processing: 'Chờ lấy hàng', shipping: 'Đang vận chuyển',
    delivered: 'Đã giao', completed: 'Hoàn thành', cancelled: 'Đã hủy',
    refunded: 'Đã hoàn tiền', refund_pending: 'Chờ duyệt hoàn tiền',
    refund_approved: 'Đã duyệt hoàn tiền'
  };
  return {
    ...order,
    shippingUnit,
    trackingCode,
    status,
    statusLabel: labels[status] || order.statusLabel || labels.pending
  };
}

// GET /api/orders
async function getOrders(req, res) {
  try {
    const { status, q } = req.query;
    if (!req.userId) {
      return res.json({ success: true, orders: [] });
    }
    const list = (await getOrdersForUser(req.userId, status, q)).map(normalizeClientOrder);
    res.json({ success: true, orders: list });
  } catch (err) {
    console.error('Lỗi server khi lấy danh sách đơn hàng:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách đơn hàng.' });
  }
}

async function getAdminOrders(req, res) {
  try {
    const orders = sortOrdersNewestFirst(await Order.getAll()).filter(order => !isLegacyDemoOrder(order));
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
    const orders = sortOrdersNewestFirst(await getOrdersForUser(user._id?.toString() || String(user.id), 'all', ''));
    for (const order of orders) {
      order.items = await Promise.all((order.items || []).map(async item => {
        const currentImage = typeof item.image === 'string' ? item.image.trim() : '';
        if (/^(https?:|data:|blob:)/i.test(currentImage)) return item;

        const product = item.sku ? await Product.getBySku(item.sku) : null;
        const thumbnail = product?.thumbnail;
        const imageId = thumbnail ? String(thumbnail) : currentImage.startsWith('/products/image/')
          ? currentImage.slice('/products/image/'.length)
          : '';
        return {
          ...item,
          image: imageId
            ? `http://localhost:3002/products/image/${encodeURIComponent(imageId)}`
            : currentImage.startsWith('/assets/') ? currentImage : ''
        };
      }));
    }
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
    const belongsToRequester = belongsToUser(order, req.userId);
      if (!order || (!order.isDemo && (order.guestOrder || isLegacyDemoOrder(order) || !belongsToRequester)) || !req.userId) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }
    res.json({ success: true, order: normalizeClientOrder(order) });
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
        sku: variant?.sku || item.sku,
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
      if (voucher && req.userId) {
        const userOrders = await Order.getAll({ userId: String(req.userId) });
        const eligibilityError = Voucher.getUserEligibilityError(voucher, userOrders, Boolean(req.userId));
        if (eligibilityError) {
          return res.status(400).json({ success: false, message: eligibilityError });
        }
      }
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
    const timelineTime = createdAt.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
    const statusNotice = 'Đơn hàng đang chờ xác nhận';
    const shippingUnit = 'J&T Express';
    const trackingCode = `JT${randomBytes(6).toString('hex').toUpperCase()}`;
    const newOrder = {
      id,
      code: `#${id.slice(-8).toUpperCase()}`,
      slug: `don-hang-${id.slice(-8).toLowerCase()}`,
      date: createdAt.toLocaleDateString('vi-VN'),
      time: createdAt.toLocaleTimeString('vi-VN'),
      createdAt,
      status: 'pending',
      isDemo: false,
      guestOrder: !req.userId,
      inventoryDeducted: true,
      soldCounted: true,
      statusLabel: 'Chờ xác nhận',
      step: 1,
      paymentStatus: 'unpaid',
      paymentStatusLabel: 'Chưa thanh toán',
      paymentMethod: String(body.paymentMethod || 'Thanh toán khi nhận hàng (COD)'),
      shippingUnit,
      trackingCode,
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
      trackingTimeline: [
        { title: 'Đặt hàng thành công', time: timelineTime, completed: true },
        { title: 'Chờ xác nhận', time: timelineTime, completed: true }
      ],
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

    const insertResult = await Product.withTransaction(async session => {
      await Product.deductStockBulk(verifiedItems, session);
      await ProductSalesService.incrementSoldCounts(verifiedItems, session);
      const result = await Order.create(newOrder, { session });
      if (result?.acknowledged !== true) {
        throw new Error(`MongoDB did not acknowledge order ${id}.`);
      }
      return result;
    });
    console.info(`Persisted order ${id} with its initial tracking timeline.`);
    res.json({ success: true, order: newOrder, persisted: true });

    AdminProduct.notifyProductChanged('sold');
    if (voucherCode) {
      Voucher.incrementUsed(voucherCode).catch(error => {
        console.error('Could not update voucher usage after saving order:', error);
      });
    }
  } catch (err) {
    if (err.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({
        success: false,
        code: err.code,
        message: `T\u1ed3n kho SKU ${err.sku} v\u1eeba thay \u0111\u1ed5i. Vui l\u00f2ng t\u1ea3i l\u1ea1i gi\u1ecf h\u00e0ng v\u00e0 th\u1eed l\u1ea1i.`
      });
    }
    if (res.headersSent) {
      console.error('A post-save order operation failed after success was sent:', err);
      return;
    }
    console.error('Lỗi khi lưu đơn hàng hoặc cập nhật số lượng đã bán:', err);
    res.status(500).json({ success: false, code: 'ORDER_CREATE_FAILED', message: 'Không thể lưu đơn hàng vào hệ thống. Đơn chưa được xác nhận; vui lòng thử lại.' });
  }
}

// PATCH /api/orders/:id
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const order = await Order.getById(id);
    const { status, cancelReason, cancelReasons, refundReason, refundNote, refundImages } = req.body || {};
    const canCancelSharedDemo = Boolean(
      order && order.isDemo && ['pending', 'processing'].includes(order.status) && status === 'cancelled' && req.userId
    );
    const canCompleteSharedDemo = Boolean(
      order && order.isDemo && order.status === 'delivered' && status === 'completed' && req.userId
    );
    const belongsToRequester = belongsToUser(order, req.userId);
      if (isLegacyDemoOrder(order) || (!belongsToRequester && !canCancelSharedDemo && !canCompleteSharedDemo)) {
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
        statusLabel: 'Đã hủy',
        notice: 'Đơn hàng đã được hủy',
        cancelReasons: normalizedCancelReasons,
        cancelReason: summarizeCancelReasons(normalizedCancelReasons)
      };
    } else if (status === 'refund_pending' && ['delivered', 'completed'].includes(order.status)) {
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

    const updated = status === 'cancelled'
      ? await cancelOrderAndRestoreStock(order, updateFields)
      : await Order.findOneAndUpdate({ id: order.id }, { $set: updateFields });
    if (!updated) {
      return res.status(status === 'cancelled' ? 409 : 404).json({
        success: false,
        message: status === 'cancelled'
          ? '\u0110\u01a1n h\u00e0ng \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt. Vui l\u00f2ng t\u1ea3i l\u1ea1i.'
          : 'Kh\u00f4ng t\u00ecm th\u1ea5y \u0111\u01a1n h\u00e0ng.'
      });
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
    const updatedAt = new Date();
    const update = {
      $set: {
        status,
        statusLabel: transition[1],
        step: status === 'delivered' ? 5 : status === 'shipping' ? 4 : 3,
        updatedAt
      }
    };
    if (status === 'processing') {
      update.$push = {
        trackingTimeline: {
          title: 'Chờ lấy hàng',
          time: updatedAt.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
          }),
          completed: true
        }
      };
    }
    const updated = await Order.findOneAndUpdate({ id: order.id, status: order.status }, update);
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
  approveRefund,
  requestGuestTrackingOtp,
  verifyGuestTrackingOtp,
  cancelGuestOrder
};
