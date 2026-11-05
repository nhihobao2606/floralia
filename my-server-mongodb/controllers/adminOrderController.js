const { ObjectId } = require('mongodb');
const Order = require('../models/order');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const initialAdminOrders = [
  {
    id: 'FL0011',
    code: '#FL0011',
    date: '10/10/2026',
    time: '11:53',
    status: 'pending',
    statusLabel: 'Chờ xác nhận',
    step: 1,
    paymentMethod: 'COD',
    paymentStatus: 'unpaid',
    paymentStatusLabel: 'Chưa thanh toán',
    receiver: {
      name: 'Minh Hoàng',
      phone: '0909 050 909',
      address: '341 Cao Đạt, Q.5, TP.HCM',
      email: 'minhhoang@gmail.com',
      customerId: '#KH101'
    },
    items: [
      {
        sku: 'THC001',
        name: 'Trà hoa cúc',
        image: '/assets/images/products/74.png',
        variant: 'Hộp 50g',
        price: 50000,
        quantity: 2,
        total: 100000
      },
      {
        sku: 'TAT002',
        name: 'Trà Atisô đỏ',
        image: '/assets/images/products/34.png',
        variant: 'Hộp 50g',
        price: 85000,
        quantity: 1,
        total: 85000
      }
    ],
    subtotal: 185000,
    discount: 0,
    shippingFee: 0,
    total: 185000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8845',
    trackingTimeline: [
      { title: 'Chờ xác nhận đơn hàng', time: '10/10 - 11:53', completed: true }
    ],
    notes: [
      { text: 'Gọi điện trước khi giao', author: 'Khách hàng', date: '10/10' }
    ]
  },
  {
    id: 'FL0010',
    code: '#FL0010',
    date: '09/10/2026',
    time: '16:20',
    status: 'processing',
    statusLabel: 'Đang chuẩn bị',
    step: 2,
    paymentMethod: 'Chuyển khoản',
    paymentStatus: 'paid',
    paymentStatusLabel: 'Đã thanh toán',
    receiver: {
      name: 'Lan Phương',
      phone: '0912 345 678',
      address: '12 Nguyễn Trãi, Q.1, TP.HCM',
      email: 'lanphuong@gmail.com',
      customerId: '#KH100'
    },
    items: [
      {
        sku: 'THC001',
        name: 'Trà hoa cúc',
        image: '/assets/images/products/74.png',
        variant: 'Hộp 100g',
        price: 80000,
        quantity: 3,
        total: 240000
      }
    ],
    subtotal: 240000,
    discount: 0,
    shippingFee: 0,
    total: 240000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8843',
    trackingTimeline: [
      { title: 'Đang chuẩn bị hàng', time: '09/10 - 16:30', completed: true },
      { title: 'Đã xác nhận đơn', time: '09/10 - 16:20', completed: true }
    ],
    notes: []
  },
  {
    id: 'FL0009',
    code: '#FL0009',
    date: '09/10/2026',
    time: '09:05',
    status: 'shipping',
    statusLabel: 'Đang giao hàng',
    step: 3,
    paymentMethod: 'VNPay',
    paymentStatus: 'paid',
    paymentStatusLabel: 'Đã thanh toán',
    receiver: {
      name: 'Thu Hà',
      phone: '0987 654 321',
      address: '88 Lê Lợi, TP. Thủ Đức, TP.HCM',
      email: 'thuha@email.com',
      customerId: '#KH102'
    },
    items: [
      {
        sku: 'TTM004',
        name: 'Lục Mễ Trà',
        image: '/assets/images/products/74.png',
        variant: 'Hộp 50g',
        price: 95000,
        quantity: 1,
        total: 95000
      },
      {
        sku: 'TTM001',
        name: 'Lam hoa trà',
        image: '/assets/images/products/82.png',
        variant: 'Hộp 100g',
        price: 75000,
        quantity: 1,
        total: 75000
      },
      {
        sku: 'TTM009',
        name: 'Liên hoa trà',
        image: '/assets/images/products/85.png',
        variant: 'Túi lọc 20 gói',
        price: 90000,
        quantity: 2,
        total: 180000
      }
    ],
    subtotal: 350000,
    discount: 0,
    shippingFee: 0,
    total: 350000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8842',
    trackingTimeline: [
      { title: 'Đang giao đến khách', time: '10/10 - 08:40', completed: true },
      { title: 'Đã đến kho Thủ Đức', time: '09/10 - 21:10', completed: true },
      { title: 'Đã bàn giao vận chuyển', time: '09/10 - 14:00', completed: true },
      { title: 'Đang chuẩn bị hàng', time: '09/10 - 10:30', completed: true },
      { title: 'Đã xác nhận đơn', time: '09/10 - 09:20', completed: true }
    ],
    notes: [
      { text: 'Yêu cầu gói quà, giao giờ hành chính.', author: 'Khách hàng', date: '09/10' }
    ]
  },
  {
    id: 'FL0008',
    code: '#FL0008',
    date: '07/10/2026',
    time: '14:41',
    status: 'delivered',
    statusLabel: 'Đã giao',
    step: 4,
    paymentMethod: 'COD',
    paymentStatus: 'paid',
    paymentStatusLabel: 'Đã thanh toán',
    receiver: {
      name: 'Quốc Bảo',
      phone: '0933 221 100',
      address: '5 Hai Bà Trưng, Q.3, TP.HCM',
      email: 'quocbao@gmail.com',
      customerId: '#KH103'
    },
    items: [
      {
        sku: 'TTM004',
        name: 'Lục Mễ Trà',
        image: '/assets/images/products/74.png',
        variant: 'Hộp 50g',
        price: 75000,
        quantity: 2,
        total: 150000
      }
    ],
    subtotal: 150000,
    discount: 0,
    shippingFee: 0,
    total: 150000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8840',
    trackingTimeline: [
      { title: 'Giao hàng thành công', time: '08/10 - 15:30', completed: true },
      { title: 'Đang giao đến khách', time: '08/10 - 09:00', completed: true },
      { title: 'Đã bàn giao vận chuyển', time: '07/10 - 17:00', completed: true },
      { title: 'Đã xác nhận đơn', time: '07/10 - 14:45', completed: true }
    ],
    notes: []
  },
  {
    id: 'FL0007',
    code: '#FL0007',
    date: '06/10/2026',
    time: '20:12',
    status: 'cancelled',
    statusLabel: 'Đã hủy',
    step: 0,
    paymentMethod: 'Chuyển khoản',
    paymentStatus: 'refunded',
    paymentStatusLabel: 'Hoàn tiền',
    receiver: {
      name: 'Ngọc Anh',
      phone: '0966 778 899',
      address: '27 Võ Văn Tần, Q.3, TP.HCM',
      email: 'ngocanh@gmail.com',
      customerId: '#KH104'
    },
    items: [
      {
        sku: 'TTM021',
        name: 'Huyết Ngọc Trà',
        image: '/assets/images/products/79.png',
        variant: 'Hộp 50g',
        price: 95000,
        quantity: 1,
        total: 95000
      }
    ],
    subtotal: 95000,
    discount: 0,
    shippingFee: 0,
    total: 95000,
    refundAmount: 95000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8839',
    trackingTimeline: [
      { title: 'Đơn hàng đã bị hủy', time: '06/10 - 21:00', completed: true }
    ],
    notes: [
      { text: 'Khách đổi ý, yêu cầu hoàn tiền chuyển khoản.', author: 'Admin', date: '06/10' }
    ]
  }
];

// Helper to expand sample list to fill realistic numbers (6 pending, 4 processing, 3 shipping, 28 delivered, 2 cancelled)
function generateFullInitialOrders() {
  const result = [...initialAdminOrders];
  const names = ['Nguyễn Văn Nam', 'Trần Thị Mai', 'Lê Hoàng Long', 'Phạm Thùy Linh', 'Đỗ Minh Trí', 'Vũ Hải Yến', 'Bùi Đức Anh', 'Phan Thanh Thảo'];
  const phones = ['0912 111 222', '0983 444 555', '0908 777 888', '0972 333 111', '0934 666 999', '0968 222 333'];
  const addresses = ['12 Lý Thường Kiệt, Q.10, TP.HCM', '45 Hoàng Diệu, Q.4, TP.HCM', '78 Lê Quang Định, Q.Bình Thạnh, TP.HCM', '23 Phan Đăng Lưu, Phú Nhuận, TP.HCM'];
  
  // Need: pending total 6 (currently 1) -> add 5
  for (let i = 1; i <= 5; i++) {
    result.push({
      id: `FL00${20 + i}`,
      code: `#FL00${20 + i}`,
      date: '11/10/2026',
      time: `10:${10 + i * 5}`,
      status: 'pending',
      statusLabel: 'Chờ xác nhận',
      step: 1,
      paymentMethod: i % 2 === 0 ? 'COD' : 'VNPay',
      paymentStatus: i % 2 === 0 ? 'unpaid' : 'paid',
      paymentStatusLabel: i % 2 === 0 ? 'Chưa thanh toán' : 'Đã thanh toán',
      receiver: {
        name: names[i % names.length],
        phone: phones[i % phones.length],
        address: addresses[i % addresses.length],
        email: `customer${i}@gmail.com`,
        customerId: `#KH${110 + i}`
      },
      items: [
        {
          sku: 'TTM001',
          name: 'Lam hoa trà - Trà hoa đậu biếc',
          image: '/assets/images/products/82.png',
          variant: 'Hộp 100g',
          price: 150000,
          quantity: 1,
          total: 150000
        }
      ],
      subtotal: 150000,
      discount: 0,
      shippingFee: 0,
      total: 150000,
      shippingUnit: 'Giao Hàng Nhanh',
      trackingCode: `GHN88${50 + i}`,
      trackingTimeline: [{ title: 'Chờ xác nhận đơn hàng', time: '11/10', completed: true }],
      notes: []
    });
  }

  // Need: processing total 4 (currently 1) -> add 3
  for (let i = 1; i <= 3; i++) {
    result.push({
      id: `FL00${30 + i}`,
      code: `#FL00${30 + i}`,
      date: '10/10/2026',
      time: `14:${15 + i * 5}`,
      status: 'processing',
      statusLabel: 'Đang chuẩn bị',
      step: 2,
      paymentMethod: 'Chuyển khoản',
      paymentStatus: 'paid',
      paymentStatusLabel: 'Đã thanh toán',
      receiver: {
        name: names[(i + 2) % names.length],
        phone: phones[(i + 1) % phones.length],
        address: addresses[(i + 1) % addresses.length],
        email: `customer${20 + i}@gmail.com`,
        customerId: `#KH${120 + i}`
      },
      items: [
        {
          sku: 'TTM012',
          name: 'Hồng Nhãn Trà',
          image: '/assets/images/products/49.png',
          variant: 'Túi zip 500g',
          price: 180000,
          quantity: 1,
          total: 180000
        }
      ],
      subtotal: 180000,
      discount: 0,
      shippingFee: 0,
      total: 180000,
      shippingUnit: 'Giao Hàng Nhanh',
      trackingCode: `GHN88${60 + i}`,
      trackingTimeline: [
        { title: 'Đang chuẩn bị hàng', time: '10/10', completed: true },
        { title: 'Đã xác nhận đơn', time: '10/10', completed: true }
      ],
      notes: []
    });
  }

  // Need: shipping total 3 (currently 1) -> add 2
  for (let i = 1; i <= 2; i++) {
    result.push({
      id: `FL00${40 + i}`,
      code: `#FL00${40 + i}`,
      date: '09/10/2026',
      time: `11:${20 + i * 5}`,
      status: 'shipping',
      statusLabel: 'Đang giao hàng',
      step: 3,
      paymentMethod: 'COD',
      paymentStatus: 'unpaid',
      paymentStatusLabel: 'Chưa thanh toán',
      receiver: {
        name: names[(i + 4) % names.length],
        phone: phones[(i + 3) % phones.length],
        address: addresses[(i + 2) % addresses.length],
        email: `customer${30 + i}@gmail.com`,
        customerId: `#KH${130 + i}`
      },
      items: [
        {
          sku: 'HQ020',
          name: 'Set Quà Tặng Trà Hoa Hồng',
          image: '/assets/images/products/131.png',
          variant: 'Hộp quà cao cấp',
          price: 320000,
          quantity: 1,
          total: 320000
        }
      ],
      subtotal: 320000,
      discount: 0,
      shippingFee: 0,
      total: 320000,
      shippingUnit: 'Giao Hàng Nhanh',
      trackingCode: `GHN88${70 + i}`,
      trackingTimeline: [
        { title: 'Đang giao đến khách', time: '10/10', completed: true },
        { title: 'Đã bàn giao vận chuyển', time: '09/10', completed: true }
      ],
      notes: []
    });
  }

  // Need: cancelled total 2 (currently 1) -> add 1
  result.push({
    id: 'FL0051',
    code: '#FL0051',
    date: '05/10/2026',
    time: '18:40',
    status: 'cancelled',
    statusLabel: 'Đã hủy',
    step: 0,
    paymentMethod: 'COD',
    paymentStatus: 'unpaid',
    paymentStatusLabel: 'Chưa thanh toán',
    receiver: {
      name: 'Võ Thành Đạt',
      phone: '0919 888 777',
      address: '99 CMT8, Q.3, TP.HCM',
      email: 'thanhdat@gmail.com',
      customerId: '#KH140'
    },
    items: [
      {
        sku: 'TTM005',
        name: 'Ngũ Linh Thang',
        image: '/assets/images/products/19.png',
        variant: 'Túi 200g',
        price: 150000,
        quantity: 1,
        total: 150000
      }
    ],
    subtotal: 150000,
    discount: 0,
    shippingFee: 0,
    total: 150000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8880',
    trackingTimeline: [{ title: 'Đơn hàng đã bị hủy', time: '05/10', completed: true }],
    notes: [{ text: 'Khách đặt trùng đơn', author: 'Khách hàng', date: '05/10' }]
  });

  // Need: delivered total 28 (currently 1) -> add 27
  for (let i = 1; i <= 27; i++) {
    result.push({
      id: `FL00${60 + i}`,
      code: `#FL00${60 + i}`,
      date: '04/10/2026',
      time: `09:${10 + (i % 50)}`,
      status: 'delivered',
      statusLabel: 'Đã giao',
      step: 4,
      paymentMethod: i % 3 === 0 ? 'Chuyển khoản' : (i % 2 === 0 ? 'VNPay' : 'COD'),
      paymentStatus: 'paid',
      paymentStatusLabel: 'Đã thanh toán',
      receiver: {
        name: names[i % names.length] + ` ${i}`,
        phone: phones[i % phones.length],
        address: addresses[i % addresses.length],
        email: `customer${60 + i}@gmail.com`,
        customerId: `#KH${150 + i}`
      },
      items: [
        {
          sku: 'TTM004',
          name: 'Lục Mễ Trà – Trà Xanh Gạo Lứt Rang',
          image: '/assets/images/products/74.png',
          variant: 'Hộp 200g',
          price: 200000,
          quantity: 1,
          total: 200000
        }
      ],
      subtotal: 200000,
      discount: 0,
      shippingFee: 0,
      total: 200000,
      shippingUnit: 'Giao Hàng Nhanh',
      trackingCode: `GHN88${90 + i}`,
      trackingTimeline: [
        { title: 'Giao hàng thành công', time: '05/10', completed: true }
      ],
      notes: []
    });
  }

  return result;
}

const ALL_SEED_ORDERS = generateFullInitialOrders();

function normalizeOrder(order) {
  if (!order) return null;
  const receiver = order.receiver || order.customer || order.sender || {};
  const items = Array.isArray(order.items) ? order.items : [];
  
  let status = order.status || 'pending';
  if (status === 'waiting') status = 'processing';
  if (status === 'completed') status = 'delivered';

  let statusLabel = order.statusLabel;
  if (!statusLabel) {
    switch (status) {
      case 'pending': statusLabel = 'Chờ xác nhận'; break;
      case 'processing': statusLabel = 'Đang chuẩn bị'; break;
      case 'shipping': statusLabel = 'Đang giao hàng'; break;
      case 'delivered': statusLabel = 'Đã giao'; break;
      case 'cancelled': statusLabel = 'Đã hủy'; break;
      case 'refunded': statusLabel = 'Đã hoàn tiền'; break;
      default: statusLabel = 'Chờ xác nhận';
    }
  }

  let paymentStatus = order.paymentStatus;
  if (!paymentStatus) {
    if (status === 'delivered' || status === 'completed') {
      paymentStatus = 'paid';
    } else if (status === 'cancelled' || status === 'refunded') {
      paymentStatus = order.refundAmount ? 'refunded' : 'unpaid';
    } else if (order.paymentMethod === 'VNPay' || order.paymentMethod === 'Paypal' || order.paymentMethod === 'Chuyển khoản') {
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

  return {
    ...order,
    id: order.id || (order._id ? String(order._id) : ''),
    code: order.code || (order.id ? (order.id.startsWith('#') ? order.id : '#' + order.id) : '#FL0000'),
    status,
    statusLabel,
    paymentStatus,
    paymentStatusLabel,
    receiver: {
      name: receiver.name || 'Khách hàng',
      phone: receiver.phone || '',
      address: receiver.address || '',
      email: receiver.email || '',
      customerId: receiver.customerId || ''
    },
    items,
    notes: Array.isArray(order.notes) ? order.notes : [],
    trackingTimeline: Array.isArray(order.trackingTimeline) ? order.trackingTimeline : []
  };
}

// GET /api/admin/orders
async function getAdminOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 5);
    const statusFilter = req.query.status || 'all';
    const paymentFilter = req.query.paymentStatus || 'all';
    const query = (req.query.q || '').trim();

    // Fetch from MongoDB
    let dbOrders = await Order.getAll();

    // If database has no orders or lacks the FL sample orders, seed/populate with ALL_SEED_ORDERS
    if (!dbOrders || dbOrders.length === 0) {
      try {
        await Order.insertMany(ALL_SEED_ORDERS);
        dbOrders = await Order.getAll();
      } catch (seedErr) {
        dbOrders = ALL_SEED_ORDERS;
      }
    } else if (!dbOrders.some(o => o.code === '#FL0011' || o.id === 'FL0011')) {
      // Ensure the specific screenshot orders are in MongoDB
      try {
        for (const item of initialAdminOrders) {
          if (!dbOrders.some(o => o.code === item.code || o.id === item.id)) {
            await Order.create(item);
          }
        }
        dbOrders = await Order.getAll();
      } catch (insertErr) {}
    }

    const allOrders = dbOrders.map(normalizeOrder);

    // Calculate status stats across all orders
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

    // Filter
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
      order = ALL_SEED_ORDERS.find(o => o.id === cleanId || o.code === id || o.code === `#${cleanId}`);
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

// POST /api/admin/orders
async function createAdminOrder(req, res) {
  try {
    const data = req.body || {};
    const count = await Order.count();
    const nextNum = String(count + 12).padStart(4, '0');
    const code = data.code || `#FL${nextNum}`;
    const id = data.id || `FL${nextNum}`;

    const newOrder = normalizeOrder({
      ...data,
      id,
      code,
      date: data.date || new Date().toLocaleDateString('vi-VN'),
      time: data.time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      status: data.status || 'pending',
      step: data.step || 1,
      createdAt: new Date(),
      trackingTimeline: [
        { title: 'Tạo đơn hàng thành công', time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), completed: true }
      ]
    });

    const result = await Order.create(newOrder);
    res.status(201).json({ success: true, order: { ...newOrder, _id: result.insertedId } });
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
    else if (status === 'processing') { step = 2; label = label || 'Đang chuẩn bị'; }
    else if (status === 'shipping') { step = 3; label = label || 'Đang giao hàng'; }
    else if (status === 'delivered') { step = 4; label = label || 'Đã giao'; }
    else if (status === 'cancelled') { step = 0; label = label || 'Đã hủy'; }

    const updateFields = { status, statusLabel: label, step, updatedAt: new Date() };

    const filter = Order.getIdFilter(id);
    let updated = await Order.findOneAndUpdate(
      filter,
      { $set: updateFields }
    );

    if (!updated) {
      // Check in fallback seed
      const cleanId = id.startsWith('#') ? id.substring(1) : id;
      const found = ALL_SEED_ORDERS.find(o => o.id === cleanId || o.code === id || o.code === `#${cleanId}`);
      if (found) {
        Object.assign(found, updateFields);
        updated = found;
      }
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
    let updated = await Order.findOneAndUpdate(
      filter,
      { $set: updateData }
    );

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
