const { ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
const Order = require('../models/order');
const Product = require('../models/product');

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
      quantity: Number(it.quantity || 1),
      total: Number(it.total || (Number(it.price || 0) * Number(it.quantity || 1))),
      image: img
    };
  }) : [];
  
  let status = String(order.status || 'pending').toLowerCase();
  if (status === 'waiting') status = 'processing';
  if (status === 'completed') status = 'delivered';

  let statusLabel = order.statusLabel;
  if (!statusLabel) {
    switch (status) {
      case 'pending': statusLabel = 'Chờ xác nhận'; break;
      case 'processing': statusLabel = 'Chờ lấy hàng'; break;
      case 'shipping': statusLabel = 'Đang vận chuyển'; break;
      case 'delivered': statusLabel = 'Đã giao'; break;
      case 'cancelled': statusLabel = 'Đã hủy'; break;
      case 'refunded': statusLabel = 'Hoàn tiền'; break;
      default: statusLabel = 'Chờ xác nhận';
    }
  } else {
    if (status === 'processing' && (statusLabel === 'Đang chuẩn bị' || statusLabel === 'ĐANG CHUẨN BỊ')) {
      statusLabel = 'Chờ lấy hàng';
    }
    if (status === 'shipping' && (statusLabel === 'Đang giao hàng' || statusLabel === 'ĐANG GIAO HÀNG')) {
      statusLabel = 'Đang vận chuyển';
    }
  }

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
    discount: Number(order.discount || 0),
    shippingFee: Number(order.shippingFee || 0),
    total: Number(order.total || 0),
    shippingUnit: order.shippingUnit || 'Giao Hàng Nhanh',
    trackingCode: order.trackingCode || '',
    notes: Array.isArray(order.notes) ? order.notes : [],
    trackingTimeline: Array.isArray(order.trackingTimeline) ? order.trackingTimeline : []
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
    const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    const code = data.code || `#FL${hex}`;
    const cleanId = code.replace(/^#/, '');
    const id = data.id || `FL${hex}`;
    const slug = `don-hang-${cleanId.toLowerCase()}`;

    const now = new Date();
    const dateStr = data.date || now.toLocaleDateString('vi-VN');
    const timeStr = data.time || now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

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

    const enrichedItems = (data.items || []).map(it => {
      const foundProd = allProducts.find(p => (p.name && p.name === it.name) || (p.title && p.title === it.name) || (p.sku && p.sku === it.sku));
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
      const itemPrice = Number(it.price || 0);

      return {
        sku,
        slug: prodSlug,
        productId,
        category,
        categorySlug,
        name: it.name,
        image,
        variant: it.variant || 'Tiêu chuẩn',
        oldPrice: Number(oldPrice || itemPrice),
        price: itemPrice,
        quantity: itemQty,
        total: Number(it.total || (itemPrice * itemQty))
      };
    });

    const subtotal = Number(data.subtotal || enrichedItems.reduce((sum, it) => sum + it.total, 0));
    const discount = Number(data.discount || 0);
    const shippingFee = Number(data.shippingFee || 0);
    const total = Number(data.total || (subtotal - discount + shippingFee));

    const status = data.status || 'pending';
    const statusLabels = {
      pending: 'Chờ xác nhận',
      processing: 'Chờ lấy hàng',
      shipping: 'Đang vận chuyển',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy'
    };
    const statusSteps = { pending: 1, processing: 2, shipping: 3, delivered: 4, cancelled: 0 };
    const statusLabel = data.statusLabel || statusLabels[status] || 'Chờ xác nhận';
    const paymentStatus = data.paymentStatus || 'unpaid';
    const paymentStatusLabels = { paid: 'Đã thanh toán', unpaid: 'Chưa thanh toán', refunded: 'Hoàn tiền' };
    const trackingCode = data.trackingCode || `GHN${Math.floor(1000 + Math.random() * 9000)}`;

    const receiver = data.receiver || {};

    // Thứ tự các trường lưu vào MongoDB theo đúng chuẩn ảnh mẫu của khách hàng
    const orderDoc = {
      id,
      code,
      slug,
      date: dateStr,
      time: timeStr,
      status,
      statusLabel,
      step: typeof data.step === 'number' ? data.step : (statusSteps[status] ?? 1),
      notice: data.notice || 'Đơn hàng đã được tạo thành công',
      paymentMethod: data.paymentMethod || 'COD',
      paymentStatus,
      paymentStatusLabel: data.paymentStatusLabel || paymentStatusLabels[paymentStatus] || 'Chưa thanh toán',
      sender: {
        name: 'Floralia Herbal Tea',
        address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
        email: 'floralia@gmail.com',
        phone: '0901 234 567'
      },
      receiver: {
        name: receiver.name || 'Khách hàng',
        phone: receiver.phone || '',
        email: receiver.email || '',
        address: receiver.address || '',
        customerId: receiver.customerId || ''
      },
      items: enrichedItems,
      subtotal,
      discount,
      shippingFee,
      total,
      shippingUnit: data.shippingUnit || 'Giao Hàng Nhanh',
      trackingCode,
      trackingTimeline: [
        { title: 'Tạo đơn hàng thành công', time: `${dateStr} - ${timeStr}`, completed: true }
      ],
      notes: [],
      createdAt: now,
      updatedAt: now
    };

    const result = await Order.create(orderDoc);
    res.status(201).json({ success: true, order: normalizeOrder({ ...orderDoc, _id: result.insertedId }) });
  } catch (err) {
    console.error('Lỗi createAdminOrder:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo đơn hàng.' });
  }
}

// PATCH /api/admin/orders/:id/status
async function updateAdminOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, statusLabel } = req.body;

    let step = 1;
    let label = statusLabel;
    if (status === 'pending') { step = 1; label = label || 'Chờ xác nhận'; }
    else if (status === 'processing') { step = 2; label = label || 'Chờ lấy hàng'; }
    else if (status === 'shipping') { step = 3; label = label || 'Đang vận chuyển'; }
    else if (status === 'delivered') { step = 4; label = label || 'Đã giao'; }
    else if (status === 'cancelled') { step = 0; label = label || 'Đã hủy'; }

    const updateFields = { status, statusLabel: label, step, updatedAt: new Date() };

    const filter = Order.getIdFilter(id);
    if (status === 'cancelled') {
      filter.status = { $in: ['pending', 'processing'] };
    }
    const updated = await Order.findOneAndUpdate(
      filter,
      { $set: updateFields }
    );

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
