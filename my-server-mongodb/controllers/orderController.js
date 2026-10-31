const Order = require('../models/order');

const initialOrders = [
  {
    id: '4152',
    code: '#4152',
    date: '4/6/2026',
    time: '09:15:20',
    status: 'processing',
    statusLabel: 'ĐANG XỬ LÝ',
    step: 2,
    paymentMethod: 'Paypal',
    sender: {
      name: 'Hà Anh',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'Haanh.BD@gmail.com',
      phone: '(671) 555-0110'
    },
    receiver: {
      name: 'Minh Trần',
      address: '12C, Võ Thị Sáu, Hà Tĩnh',
      email: 'MinhTran.thuu@gmail.com',
      phone: '(671) 555-0110'
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
      },
      {
        sku: 'TTM010',
        name: 'Lam Diệp Trà – Trà Hắc Kỷ Tử',
        image: '/assets/images/products/34.png',
        variant: 'Hộp 100g',
        price: 250000,
        quantity: 1,
        total: 250000
      },
      {
        sku: 'TTM021',
        name: 'Huyết Ngọc Trà – Trà Bổ Huyết Dưỡng Nhan',
        image: '/assets/images/products/79.png',
        variant: 'Hộp 200g',
        price: 250000,
        quantity: 1,
        total: 250000
      }
    ],
    subtotal: 700000,
    discount: 155000,
    shippingFee: 0,
    total: 545000
  },
  {
    id: '5028',
    code: '#5028',
    date: '15/10/2026',
    time: '21:30:08',
    status: 'delivered',
    statusLabel: 'ĐÃ GIAO',
    step: 4,
    notice: 'Giao hàng thành công vào 17/10/2026',
    paymentMethod: 'COD',
    sender: {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: 'Hồ Bảo Nhi',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'hobaonhi400@gmail.com',
      phone: '0901 234 567'
    },
    items: [
      {
        sku: 'TTM012',
        name: 'Hồng Nhãn Trà - Trà Kỷ Tử',
        image: '/assets/images/products/49.png',
        variant: 'Phân loại hàng: Túi zip 500g',
        price: 350000,
        quantity: 1,
        total: 350000
      }
    ],
    subtotal: 350000,
    discount: 0,
    shippingFee: 0,
    total: 350000
  },
  {
    id: '5027',
    code: '#5028',
    date: '15/10/2026',
    time: '21:30:08',
    status: 'pending',
    statusLabel: 'CHỜ XÁC NHẬN',
    step: 1,
    paymentMethod: 'Chuyển khoản ngân hàng',
    sender: {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: 'Hồ Bảo Nhi',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'hobaonhi400@gmail.com',
      phone: '0901 234 567'
    },
    items: [
      {
        sku: 'HQ020',
        name: 'Set Quà Tặng Trà Hoa Hồng',
        image: '/assets/images/products/131.png',
        variant: '',
        price: 632000,
        quantity: 1,
        total: 632000
      }
    ],
    subtotal: 632000,
    discount: 0,
    shippingFee: 18000,
    total: 650000
  },
  {
    id: '3933',
    code: '#3933',
    date: '14/10/2026',
    time: '23:01:06',
    status: 'completed',
    statusLabel: 'HOÀN THÀNH',
    step: 4,
    notice: 'Giao hàng thành công',
    paymentMethod: 'COD',
    sender: {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: 'Hồ Bảo Nhi',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'hobaonhi400@gmail.com',
      phone: '0901 234 567'
    },
    items: [
      {
        sku: 'TTM001',
        name: 'Lam Hoa Trà - Trà Hoa Đậu Biếc',
        image: '/assets/images/products/82.png',
        variant: 'Phân loại hàng: Hộp 100g',
        price: 150000,
        oldPrice: 200000,
        quantity: 2,
        total: 300000
      },
      {
        sku: 'TTM009',
        name: 'Ngọc Lan Trà – Trà Hoa Bạch Nhài',
        image: '/assets/images/products/85.png',
        variant: 'Phân loại hàng: Hộp 10 gói',
        price: 78000,
        quantity: 1,
        total: 78000
      }
    ],
    subtotal: 378000,
    discount: 142000,
    shippingFee: 0,
    total: 236000
  },
  {
    id: '5045',
    code: '#5045',
    date: '13/10/2026',
    time: '10:05:30',
    status: 'shipping',
    statusLabel: 'ĐANG VẬN CHUYỂN',
    step: 3,
    notice: 'Đơn hàng đang trên đường giao',
    paymentMethod: 'COD',
    sender: {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: 'Hồ Bảo Nhi',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'hobaonhi400@gmail.com',
      phone: '0901 234 567'
    },
    items: [
      {
        sku: 'TTM005',
        name: 'Ngũ Linh Thang – Nhân Sâm Ngũ Bảo Trà Nam',
        image: '/assets/images/products/19.png',
        variant: 'Phân loại hàng: Túi 200g',
        price: 150000,
        oldPrice: 165000,
        quantity: 1,
        total: 150000
      }
    ],
    subtotal: 165000,
    discount: 15000,
    shippingFee: 0,
    total: 150000
  },
  {
    id: '5026',
    code: '#5026',
    date: '13/10/2026',
    time: '10:05:30',
    status: 'cancelled',
    statusLabel: 'ĐÃ HỦY',
    step: 0,
    paymentMethod: 'COD',
    sender: {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: 'Hồ Bảo Nhi',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'hobaonhi400@gmail.com',
      phone: '0901 234 567'
    },
    items: [
      {
        sku: 'AT021',
        name: 'Set Ấm Trà Tử Sa Cá Chép + Lục Mễ Trà',
        image: '/assets/images/products/94.png',
        variant: '',
        price: 950000,
        oldPrice: 1200000,
        quantity: 1,
        total: 950000
      }
    ],
    subtotal: 1200000,
    discount: 250000,
    shippingFee: 0,
    total: 950000
  },
  {
    id: '5010',
    code: '#5010',
    date: '11/10/2026',
    time: '15:25:09',
    status: 'refunded',
    statusLabel: 'ĐÃ HOÀN TIỀN',
    step: 0,
    paymentMethod: 'Chuyển khoản',
    sender: {
      name: 'Floralia Herbal Tea',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'floralia@gmail.com',
      phone: '0901 234 567'
    },
    receiver: {
      name: 'Hồ Bảo Nhi',
      address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
      email: 'hobaonhi400@gmail.com',
      phone: '0901 234 567'
    },
    items: [
      {
        sku: 'TTM005',
        name: 'Ngũ Linh Thang – Nhân Sâm Ngũ Bảo Trà Nam',
        image: '/assets/images/products/19.png',
        variant: 'Phân loại hàng: Túi 200g',
        price: 150000,
        oldPrice: 165000,
        quantity: 1,
        total: 150000
      }
    ],
    subtotal: 165000,
    discount: 15000,
    shippingFee: 0,
    total: 150000,
    refundAmount: 150000
  }
];

// GET /api/orders
async function getOrders(req, res) {
  try {
    const { status, q } = req.query;
    let list = await Order.getAll();

    if (!list || list.length === 0) {
      list = [...initialOrders];
    }

    if (status && status !== 'all') {
      list = list.filter(o => o.status === status);
    }

    if (q) {
      const term = q.trim().toLowerCase();
      list = list.filter(o =>
        (o.id && o.id.toLowerCase().includes(term)) ||
        (o.code && o.code.toLowerCase().includes(term)) ||
        (o.items && o.items.some(it => it.name.toLowerCase().includes(term)))
      );
    }

    res.json({ success: true, orders: list });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách đơn hàng.' });
  }
}

// GET /api/orders/:id
async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    let order = await Order.getById(id);
    if (!order) {
      order = initialOrders.find(o => o.id === id || o.code === `#${id}`);
    }
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi lấy chi tiết đơn hàng.' });
  }
}

// POST /api/orders
async function createOrder(req, res) {
  try {
    const id = req.body.id || String(Math.floor(1000 + Math.random() * 9000));
    const newOrder = {
      id: id,
      code: req.body.code || ('#' + id),
      date: req.body.date || new Date().toLocaleDateString('vi-VN'),
      time: req.body.time || new Date().toLocaleTimeString('vi-VN'),
      status: req.body.status || 'processing',
      statusLabel: req.body.statusLabel || 'ĐANG XỬ LÝ',
      step: req.body.step || 2,
      ...req.body
    };
    await Order.create(newOrder);
    res.json({ success: true, order: newOrder });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo đơn hàng.' });
  }
}

// PATCH /api/orders/:id
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, statusLabel } = req.body;
    const query = { $or: [{ id }, { code: `#${id}` }, { code: id }] };
    const updated = await Order.findOneAndUpdate(
      query,
      { $set: { status, statusLabel } },
      { new: true }
    );
    res.json({ success: true, order: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật trạng thái đơn hàng.' });
  }
}

module.exports = {
  initialOrders,
  getOrders,
  getOrderById,
  createOrder,
  updateOrderStatus
};
