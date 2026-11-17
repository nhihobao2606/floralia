const { ObjectId } = require('mongodb');
const { randomBytes } = require('crypto');
const path = require('path');
const fs = require('fs');
const Order = require('../models/order');
const Product = require('../models/product');
const ProductSalesService = require('../models/product-sales-service');
const AdminProduct = require('../models/adminProduct');
const { cancelOrderAndRestoreStock } = require('../models/order-cancellation-service');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeOrder(order) {
  if (!order) return null;
  const receiver = order.receiver || order.customer || order.sender || {};
  const items = Array.isArray(order.items) ? order.items.map(it => {
    let img = it.image || '';
    if (img && img.startsWith('/products/image/')) {
      img = `http://localhost:3002${img}`;
    } else if (!img) {
      img = '/assets/images/products/74.png';
    }
    return {
      sku: it.sku || '',
      slug: it.slug || '',
      productId: it.productId || '',
      category: it.category || '',
      name: it.name || it.productName || 'Sản phẩm Floralia',
      variant: it.variant || 'Tiêu chuẩn',
      price: Number(it.price || 0),
      oldPrice: Number(it.oldPrice || it.price || 0),
      salePrice: Number(it.salePrice ?? it.price ?? 0),
      productDiscount: Number(it.productDiscount || 0),
      quantity: Number(it.quantity || 1),
      total: Number(it.total || (Number(it.price || 0) * Number(it.quantity || 1))),
      image: img
    };
  }) : [];
  
  let status = String(order.status || 'pending').toLowerCase();
  if (status === 'waiting') status = 'processing';
  if (status === 'completed') status = 'delivered';

  const statusLabels = {
    pending: 'Chờ xác nhận', processing: 'Chờ lấy hàng', shipping: 'Đang vận chuyển',
    delivered: 'Đã giao', cancelled: 'Đã hủy', refunded: 'Đã hoàn tiền',
    refund_pending: 'Chờ duyệt hoàn tiền', refund_approved: 'Đã duyệt hoàn tiền', completed: 'Hoàn thành'
  };
  // Status is the source of truth: legacy records may contain stale labels from older flows.
  const statusLabel = statusLabels[status] || order.statusLabel || statusLabels.pending;

  let paymentStatus = order.paymentStatus;
  if (!paymentStatus) {
    if (status === 'delivered' || status === 'completed') {
      paymentStatus = 'paid';
    } else if (status === 'cancelled' || status === 'refunded') {
      paymentStatus = order.refundAmount ? 'refunded' : 'unpaid';
    } else if (order.paymentMethod === 'VNPay' || order.paymentMethod === 'Paypal' || order.paymentMethod === 'Chuyển khoản' || order.paymentMethod === 'MoMo') {
      paymentStatus = 'paid';
    } else {
      paymentStatus = 'unpaid';
    }
  }

  let paymentStatusLabel = order.paymentStatusLabel;
  if (!paymentStatusLabel) {
    switch (paymentStatus) {
      case 'paid': paymentStatusLabel = 'Đã thanh toán'; break;
      case 'refunded': paymentStatusLabel = 'Hoàn tiền'; break;
      default: paymentStatusLabel = 'Chưa thanh toán';
    }
  }

  const rawId = String(order.id || (order._id ? String(order._id) : ''));
  const rawCode = String(order.code || rawId);
  const code = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;
  const cleanId = code.replace(/^#/, '');

  return {
    ...order,
    _id: order._id ? String(order._id) : undefined,
    id: rawId || cleanId,
    code,
    slug: order.slug || `don-hang-${cleanId.toLowerCase()}`,
    date: order.date || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')),
    time: order.time || (order.createdAt ? new Date(order.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '10:00'),
    status,
    statusLabel,
    step: typeof order.step === 'number' ? order.step : 1,
    notice: order.notice || '',
    paymentMethod: order.paymentMethod || 'COD',
    paymentStatus,
    paymentStatusLabel,
    sender: order.sender || {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: receiver.name || 'Khách hàng',
      phone: receiver.phone || '',
      address: receiver.address || '',
      email: receiver.email || '',
      customerId: receiver.customerId || (order.userId ? `#KH${String(order.userId).slice(-4).toUpperCase()}` : '')
    },
    items,
    subtotal: Number(order.subtotal || 0),
    productDiscount: Number(order.productDiscount || 0),
    discount: Number(order.discount || 0),
    shippingFee: Number(order.shippingFee || 0),
    total: Number(order.total || 0),
    shippingUnit: order.shippingUnit || '',
    trackingCode: order.trackingCode || '',
    notes: Array.isArray(order.notes) ? order.notes : [],
    trackingTimeline: Array.isArray(order.trackingTimeline) ? order.trackingTimeline.map(step => ({
      ...step,
      title: step.title || step.statusLabel || '',
      time: step.time || (step.createdAt ? new Date(step.createdAt).toLocaleString('vi-VN') : ''),
      completed: step.completed !== false
    })) : []
  };
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
  }
  return 0;
}

// GET /api/admin/orders
async function getAdminOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 5);
    const statusFilter = req.query.status || 'all';
    const paymentFilter = req.query.paymentStatus || 'all';
    const query = (req.query.q || '').trim();
    const userId = String(req.query.userId || '').trim();

    // Lấy toàn bộ danh sách đơn hàng thực tế từ MongoDB
    let dbOrders = await Order.getAll();
    if (!dbOrders) dbOrders = [];

    // Sắp xếp đơn hàng mới nhất lên đầu
    dbOrders.sort((a, b) => parseOrderTimestamp(b) - parseOrderTimestamp(a));

    const allOrders = dbOrders.map(normalizeOrder);

    // Tính thống kê trạng thái trên toàn bộ dữ liệu thực tế
    const stats = {
      total: allOrders.length,
      pending: 0,
      processing: 0,
      shipping: 0,
      delivered: 0,
      cancelled: 0
    };

    for (const o of allOrders) {
      if (o.status === 'pending') stats.pending++;
      else if (o.status === 'processing' || o.status === 'waiting') stats.processing++;
      else if (o.status === 'shipping') stats.shipping++;
      else if (o.status === 'delivered' || o.status === 'completed') stats.delivered++;
      else if (o.status === 'cancelled' || o.status === 'refunded') stats.cancelled++;
    }

    // Lọc theo trạng thái
    let filtered = allOrders;

    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter(o => {
        if (statusFilter === 'processing') return o.status === 'processing' || o.status === 'waiting';
        if (statusFilter === 'delivered') return o.status === 'delivered' || o.status === 'completed';
        if (statusFilter === 'cancelled') return o.status === 'cancelled' || o.status === 'refunded';
        return o.status === statusFilter;
      });
    }

    if (paymentFilter && paymentFilter !== 'all') {
      filtered = filtered.filter(o => o.paymentStatus === paymentFilter);
    }

    if (userId) {
      filtered = filtered.filter(o => String(o.userId ?? '') === userId);
    }

    if (query) {
      const qLower = query.toLowerCase();
      filtered = filtered.filter(o => {
        const codeMatch = (o.code || '').toLowerCase().includes(qLower) || (o.id || '').toLowerCase().includes(qLower);
        const nameMatch = (o.receiver?.name || '').toLowerCase().includes(qLower);
        const phoneMatch = (o.receiver?.phone || '').toLowerCase().includes(qLower);
        const itemMatch = o.items.some(i => (i.name || '').toLowerCase().includes(qLower));
        return codeMatch || nameMatch || phoneMatch || itemMatch;
      });
    }

    const total = filtered.length;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      orders: paginated,
      total,
      page,
      limit,
      stats
    });
  } catch (err) {
    console.error('Lỗi getAdminOrders:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách đơn hàng.' });
  }
}

// GET /api/admin/orders/:id
async function getAdminOrderById(req, res) {
  try {
    const { id } = req.params;
    let order = await Order.getById(id);
    if (!order) {
      const cleanId = id.startsWith('#') ? id.substring(1) : id;
      order = await Order.getBySlug(cleanId);
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    res.json({ success: true, order: normalizeOrder(order) });
  } catch (err) {
    console.error('Lỗi getAdminOrderById:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết đơn hàng.' });
  }
}

// POST /api/admin/orders - Lưu theo đúng thứ tự các trường trên hình MongoDB
async function createAdminOrder(req, res) {
  try {
    const data = req.body || {};
    const now = new Date();
    const id = randomBytes(16).toString('hex');
    const code = `#${id.slice(-8).toUpperCase()}`;
    const cleanId = code.slice(1);
    const slug = `don-hang-${cleanId.toLowerCase()}`;
    const dateStr = now.toLocaleDateString('vi-VN');
    const timeStr = now.toLocaleTimeString('vi-VN');
    const timelineTime = now.toLocaleString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });

    // Lấy thông tin chi tiết sản phẩm từ MongoDB Product
    let allProducts = [];
    try {
      allProducts = await Product.getAll();
    } catch (e) {
      allProducts = [];
    }
    if (!allProducts || allProducts.length === 0) {
      try {
        const catalogPath = path.join(__dirname, '../../client/src/app/data/products.updated.json');
        if (fs.existsSync(catalogPath)) {
          allProducts = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        }
      } catch (e) {}
    }

    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 50) {
      return res.status(400).json({ success: false, message: 'Đơn hàng cần có từ 1 đến 50 dòng sản phẩm.' });
    }
    const requestedBySku = new Map();
    for (const item of data.items) {
      const sku = String(item?.sku || '').trim();
      const quantity = Number(item?.quantity);
      if (!sku || !Number.isSafeInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, message: 'SKU và số lượng sản phẩm không hợp lệ.' });
      }
      requestedBySku.set(sku, (requestedBySku.get(sku) || 0) + quantity);
    }
    for (const [sku, quantity] of requestedBySku) {
      const product = allProducts.find(item => item.sku === sku || item.variants?.some(variant => variant.sku === sku));
      if (!product) return res.status(400).json({ success: false, message: `Không tìm thấy sản phẩm ${sku}.` });
      const variant = product.variants?.find(item => item.sku === sku);
      if (product.variants?.length && !variant) {
        return res.status(400).json({
          success: false,
          message: `SKU ${sku} c\u1ea7n l\u00e0 m\u00e3 ph\u00e2n lo\u1ea1i c\u1ee5 th\u1ec3.`
        });
      }
      const stock = Number(variant?.stock ?? product.stock);
      if (Number.isFinite(stock) && quantity > stock) {
        return res.status(400).json({ success: false, message: `SKU ${sku} chỉ còn ${stock} sản phẩm trong kho.` });
      }
    }

    const enrichedItems = (data.items || []).map(it => {
      const foundProd = allProducts.find(p => (p.name && p.name === it.name) || (p.title && p.title === it.name) || (p.sku && p.sku === it.sku) || p.variants?.some(variant => variant.sku === it.sku));
      let image = it.image;
      let sku = it.sku || '';
      let prodSlug = it.slug || '';
      let productId = it.productId || '';
      let category = it.category || 'Trà thảo mộc';
      let categorySlug = it.categorySlug || 'tra-thao-moc';
      let oldPrice = it.oldPrice || it.price;

      if (foundProd) {
        productId = String(foundProd._id || foundProd.id || '');
        prodSlug = foundProd.slug || prodSlug;
        category = foundProd.category || category;
        categorySlug = foundProd.categorySlug || categorySlug;
        const thumb = foundProd.thumbnail || (foundProd.sku ? `${foundProd.sku}_THUMB` : '');
        if (thumb) {
          image = `http://localhost:3002/products/image/${thumb}`;
        }
        if (Array.isArray(foundProd.variants)) {
          const matchedVar = foundProd.variants.find(v => v.label === it.variant || v.sku === it.sku);
          if (matchedVar) {
            sku = matchedVar.sku || foundProd.sku;
            oldPrice = matchedVar.oldPrice || matchedVar.price || it.price;
          } else {
            sku = foundProd.sku || sku;
          }
        }
      }

      if (!image || !image.startsWith('http')) {
        if (image && image.startsWith('/products/image/')) {
          image = `http://localhost:3002${image}`;
        } else if (foundProd && foundProd.thumbnail) {
          image = `http://localhost:3002/products/image/${foundProd.thumbnail}`;
        } else {
          image = '/assets/images/products/74.png';
        }
      }

      const itemQty = Number(it.quantity || 1);
      const matchedVariant = foundProd?.variants?.find(v => v.sku === it.sku || v.label === it.variant);
      const salePrice = Number(matchedVariant?.price ?? foundProd?.price ?? it.price ?? 0);
      const itemPrice = Number(matchedVariant?.oldPrice || foundProd?.oldPrice || salePrice);
      const productDiscount = Math.max(0, itemPrice - salePrice) * itemQty;

      return {
        sku,
        slug: prodSlug,
        productId,
        category,
        categorySlug,
        name: it.name,
        image,
        variant: it.variant || 'Tiêu chuẩn',
        oldPrice: itemPrice,
        price: itemPrice,
        salePrice,
        productDiscount,
        quantity: itemQty,
        total: itemPrice * itemQty
      };
    });

    const subtotal = enrichedItems.reduce((sum, item) => sum + item.total, 0);
    const productDiscount = enrichedItems.reduce((sum, item) => sum + item.productDiscount, 0);
    const saleSubtotal = Math.max(0, subtotal - productDiscount);
    const requestedDiscount = Number(data.discount || 0);
    const shippingFee = Number(data.shippingFee || 0);
    if (!Number.isSafeInteger(requestedDiscount) || requestedDiscount < 0 || !Number.isSafeInteger(shippingFee) || shippingFee < 0) {
      return res.status(400).json({ success: false, message: 'Phí vận chuyển và giảm giá phải là số nguyên không âm.' });
    }
    const discount = productDiscount + Math.min(requestedDiscount, saleSubtotal);
    const total = subtotal - discount + shippingFee;
    const status = 'pending';
    const paymentStatus = data.paymentStatus === 'paid' ? 'paid' : 'unpaid';
    const paymentStatusLabels = { paid: '\u0110\u00e3 thanh to\u00e1n', unpaid: 'Ch\u01b0a thanh to\u00e1n' };
    const paymentMethod = data.paymentMethod === 'COD'
      ? 'Thanh to\u00e1n khi nh\u1eadn h\u00e0ng (COD)'
      : (data.paymentMethod || 'Thanh to\u00e1n khi nh\u1eadn h\u00e0ng (COD)');
    const trackingCode = `JT${randomBytes(6).toString('hex').toUpperCase()}`;
    const receiver = data.receiver || {};

    // Keep the persisted field order and guest-order shape aligned with checkout orders.
    const orderDoc = {
      id,
      code,
      slug,
      date: dateStr,
      time: timeStr,
      createdAt: now,
      status,
      isDemo: false,
      guestOrder: true,
      inventoryDeducted: true,
      soldCounted: true,
      statusLabel: 'Ch\u1edd x\u00e1c nh\u1eadn',
      step: 1,
      paymentStatus,
      paymentStatusLabel: paymentStatusLabels[paymentStatus],
      paymentMethod,
      shippingUnit: data.shippingUnit || 'J&T Express',
      trackingCode,
      sender: {
        name: 'Floralia Herbal Tea',
        address: '11A B\u1ebf V\u0103n \u0110\u00e0n, D\u0129 An, B\u00ecnh D\u01b0\u01a1ng',
        email: 'floralia@gmail.com',
        phone: '0901 234 567'
      },
      receiver: {
        name: receiver.name || 'Kh\u00e1ch h\u00e0ng',
        address: receiver.address || '',
        email: receiver.email || '',
        phone: receiver.phone || ''
      },
      items: enrichedItems,
      notice: '\u0110\u01a1n h\u00e0ng \u0111ang ch\u1edd x\u00e1c nh\u1eadn',
      trackingTimeline: [
        { title: '\u0110\u1eb7t h\u00e0ng th\u00e0nh c\u00f4ng', time: timelineTime, completed: true },
        { title: 'Ch\u1edd x\u00e1c nh\u1eadn', time: timelineTime, completed: true }
      ],
      notes: [],
      ...(typeof data.customerNote === 'string' && data.customerNote.trim() ? { customerNote: data.customerNote.trim() } : {}),
      subtotal,
      productDiscount,
      discount,
      shippingFee,
      total,
      ...(typeof data.source === 'string' && data.source.trim() ? { source: data.source.trim() } : {})
    };

    const result = await Product.withTransaction(async session => {
      await Product.deductStockBulk(enrichedItems, session);
      await ProductSalesService.incrementSoldCounts(enrichedItems, session);
      const inserted = await Order.create(orderDoc, { session });
      if (inserted?.acknowledged !== true) throw new Error(`MongoDB did not acknowledge order ${id}.`);
      return inserted;
    });
    AdminProduct.notifyProductChanged('sold');
    res.status(201).json({ success: true, order: normalizeOrder({ ...orderDoc, _id: result.insertedId }) });
  } catch (err) {
    if (err.code === 'INSUFFICIENT_STOCK') {
      return res.status(409).json({
        success: false,
        code: err.code,
        message: `T\u1ed3n kho SKU ${err.sku} v\u1eeba thay \u0111\u1ed5i. Vui l\u00f2ng ki\u1ec3m tra l\u1ea1i t\u1ed3n kho.`
      });
    }
    console.error('Lỗi createAdminOrder:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo đơn hàng.' });
  }
}

// PATCH /api/admin/orders/:id/status
async function updateAdminOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const currentOrder = status === 'cancelled' ? await Order.getById(id) : null;

    const statusInfo = {
      pending: { step: 1, label: 'Chờ xác nhận', notice: 'Đơn hàng đang chờ xác nhận.' },
      processing: { step: 2, label: 'Chờ lấy hàng', notice: 'Đơn hàng đang chờ đơn vị vận chuyển lấy hàng.' },
      shipping: { step: 3, label: 'Đang vận chuyển', notice: 'Đơn hàng đang được vận chuyển.' },
      delivered: { step: 4, label: 'Đã giao', notice: 'Đơn hàng đã được giao.' },
      completed: { step: 5, label: 'Hoàn thành', notice: 'Đơn hàng đã hoàn thành.' },
      cancelled: { step: 0, label: 'Đã hủy', notice: 'Đơn hàng đã được hủy.' },
      refunded: { step: 0, label: 'Đã hoàn tiền', notice: 'Đơn hàng đã được hoàn tiền.' },
      refund_pending: { step: 0, label: 'Chờ duyệt hoàn tiền', notice: 'Yêu cầu hoàn tiền đang chờ duyệt.' },
      refund_approved: { step: 0, label: 'Đã duyệt hoàn tiền', notice: 'Yêu cầu hoàn tiền đã được duyệt.' }
    };
    const info = statusInfo[status];
    if (!info) return res.status(400).json({ success: false, message: 'Trạng thái đơn hàng không hợp lệ.' });
    const updatedAt = new Date();
    const updateFields = { status, statusLabel: info.label, notice: info.notice, step: info.step, updatedAt };

    const filter = Order.getIdFilter(id);
    if (status === 'cancelled') {
      // Older orders used `waiting` for the same state as `processing`.
      filter.status = { $in: ['pending', 'processing', 'waiting'] };
    } else if (status === 'processing') {
      filter.status = { $in: ['pending', 'waiting'] };
    }
    const update = { $set: updateFields };
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
    const canCancelCurrentOrder = currentOrder && ['pending', 'processing', 'waiting'].includes(currentOrder.status);
    const updated = status === 'cancelled' && canCancelCurrentOrder
      ? await cancelOrderAndRestoreStock(currentOrder, updateFields)
      : await Order.findOneAndUpdate(filter, update);

    if (!updated) {
      if (status === 'cancelled') {
        return res.status(409).json({ success: false, message: 'Chỉ có thể hủy đơn hàng đang chờ xác nhận hoặc chờ lấy hàng.' });
      }
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng cần cập nhật.' });
    }

    res.json({ success: true, order: normalizeOrder(updated) });
  } catch (err) {
    console.error('Lỗi updateAdminOrderStatus:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái đơn hàng.' });
  }
}

// PATCH /api/admin/orders/:id
async function updateAdminOrder(req, res) {
  try {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData._id;

    const filter = Order.getIdFilter(id);
    const updated = await Order.findOneAndUpdate(
      filter,
      { $set: updateData }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng để cập nhật.' });
    }

    res.json({ success: true, order: normalizeOrder(updated) });
  } catch (err) {
    console.error('Lỗi updateAdminOrder:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật đơn hàng.' });
  }
}

// POST /api/admin/orders/:id/notes
async function addAdminOrderNote(req, res) {
  try {
    const { id } = req.params;
    const { text, author } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung ghi chú không được trống.' });
    }

    const newNote = {
      text: text.trim(),
      author: author || 'Admin',
      date: new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      createdAt: new Date()
    };

    const filter = Order.getIdFilter(id);
    const updated = await Order.findOneAndUpdate(
      filter,
      { $push: { notes: newNote } }
    );

    res.json({ success: true, note: newNote, order: normalizeOrder(updated) });
  } catch (err) {
    console.error('Lỗi addAdminOrderNote:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm ghi chú.' });
  }
}

// DELETE /api/admin/orders/:id
async function deleteAdminOrder(req, res) {
  try {
    const { id } = req.params;
    const filter = Order.getIdFilter(id);
    await Order.deleteOne(filter);
    res.json({ success: true, message: 'Đã xóa đơn hàng thành công.' });
  } catch (err) {
    console.error('Lỗi deleteAdminOrder:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa đơn hàng.' });
  }
}

// POST /api/admin/orders/bulk-delete
async function bulkDeleteAdminOrders(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ.' });
    }

    const conditions = ids.map(id => Order.getIdFilter(id));
    await Order.deleteMany({ $or: conditions });

    res.json({ success: true, message: `Đã xóa ${ids.length} đơn hàng thành công.` });
  } catch (err) {
    console.error('Lỗi bulkDeleteAdminOrders:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xóa nhiều đơn hàng.' });
  }
}

module.exports = {
  getAdminOrders,
  getAdminOrderById,
  createAdminOrder,
  updateAdminOrderStatus,
  updateAdminOrder,
  addAdminOrderNote,
  deleteAdminOrder,
  bulkDeleteAdminOrders
};
