const Order = require('../models/order');
const Product = require('../models/product');
const User = require('../models/user');
const Blog = require('../models/blog');
const Voucher = require('../models/voucher');

function parseOrderDate(order) {
  if (order.createdAt) {
    const d = new Date(order.createdAt);
    if (!isNaN(d.getTime())) return d;
  }
  if (order.date) {
    const parts = String(order.date).split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      let h = 0, m = 0, s = 0;
      if (order.time) {
        const timeParts = String(order.time).split(':');
        h = parseInt(timeParts[0], 10) || 0;
        m = parseInt(timeParts[1], 10) || 0;
        s = parseInt(timeParts[2], 10) || 0;
      }
      const d = new Date(year, month, day, h, m, s);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return new Date(0);
}

function normalizeImageUrl(thumbOrUrl) {
  if (!thumbOrUrl) return '/assets/images/products/74.png';
  if (thumbOrUrl.startsWith('http://') || thumbOrUrl.startsWith('https://')) return thumbOrUrl;
  if (thumbOrUrl.startsWith('/products/image/')) return `http://localhost:3002${thumbOrUrl}`;
  if (thumbOrUrl.startsWith('/assets/')) return thumbOrUrl;
  return `http://localhost:3002/products/image/${thumbOrUrl}`;
}

async function getDashboardData(req, res) {
  try {
    const period = req.query.period || 'all'; // 'all', '7days', '30days', 'month'

    // 1. Fetch raw data in parallel
    const [rawOrders, rawProducts, rawUsers, rawBlogs, rawVouchers] = await Promise.all([
      Order.getAll().catch(() => []),
      Product.getAll().catch(() => []),
      User.getAllUsers ? User.getAllUsers().catch(() => []) : Promise.resolve([]),
      Blog.getAll ? Blog.getAll().catch(() => []) : Promise.resolve([]),
      Voucher.getAll ? Voucher.getAll().catch(() => []) : Promise.resolve([])
    ]);

    const orders = Array.isArray(rawOrders) ? rawOrders : [];
    const products = Array.isArray(rawProducts) ? rawProducts : [];
    const users = Array.isArray(rawUsers) ? rawUsers : [];
    const blogs = Array.isArray(rawBlogs) ? rawBlogs : [];
    const vouchers = Array.isArray(rawVouchers) ? rawVouchers : [];

    // 2. Sort orders newest first
    orders.sort((a, b) => parseOrderDate(b).getTime() - parseOrderDate(a).getTime());

    // 3. Filter orders by period if specified
    const now = new Date();
    let filteredOrders = orders;
    if (period === '7days') {
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => parseOrderDate(o) >= past7);
    } else if (period === '30days') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => parseOrderDate(o) >= past30);
    } else if (period === 'month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredOrders = orders.filter(o => parseOrderDate(o) >= firstOfMonth);
    }

    // 4. Calculate Order & Revenue stats
    let totalRevenue = 0;
    let deliveredRevenue = 0;
    let pendingOrders = 0;
    let processingOrders = 0;
    let shippingOrders = 0;
    let deliveredOrders = 0;
    let cancelledOrders = 0;

    for (const o of filteredOrders) {
      let st = String(o.status || 'pending').toLowerCase();
      if (st === 'waiting') st = 'processing';
      if (st === 'completed') st = 'delivered';

      const orderTotal = Number(o.total || 0);

      if (st === 'pending') {
        pendingOrders++;
      } else if (st === 'processing') {
        processingOrders++;
      } else if (st === 'shipping') {
        shippingOrders++;
      } else if (st === 'delivered') {
        deliveredOrders++;
        deliveredRevenue += orderTotal;
      } else if (st === 'cancelled' || st === 'refunded') {
        cancelledOrders++;
      }

      // Doanh thu tính từ tất cả đơn hợp lệ không bị hủy
      if (st !== 'cancelled' && st !== 'refunded') {
        totalRevenue += orderTotal;
      }
    }

    const totalOrders = filteredOrders.length;
    const nonCancelledCount = totalOrders - cancelledOrders;
    const completionRate = nonCancelledCount > 0
      ? Math.round((deliveredOrders / nonCancelledCount) * 1000) / 10
      : 0;

    // 5. Inventory analysis, using the same per-variant threshold as inventory management.
    const LOW_STOCK_THRESHOLD = 10;
    let inStockProducts = 0;
    let lowStockProducts = 0;
    let outOfStockProducts = 0;
    const lowStockAlerts = [];

    for (const p of products) {
      const thumb = p.thumbnail || (p.sku ? `${p.sku}_THUMB` : '');
      const imageUrl = normalizeImageUrl(thumb);
      const variants = Array.isArray(p.variants) && p.variants.length
        ? p.variants
        : [{ sku: p.sku, label: 'Tiêu chuẩn', stock: p.stock }];
      const stocks = variants.map(variant => Math.max(0, Number(variant.stock) || 0));
      if (stocks.some(stock => stock >= LOW_STOCK_THRESHOLD)) inStockProducts++;
      if (stocks.some(stock => stock > 0 && stock < LOW_STOCK_THRESHOLD)) lowStockProducts++;
      if (stocks.some(stock => stock === 0)) outOfStockProducts++;

      variants.forEach((variant, index) => {
        const stock = stocks[index];
        if (stock >= LOW_STOCK_THRESHOLD) return;
        const isOut = stock === 0;
        lowStockAlerts.push({
          id: String(p._id || p.id || p.sku || ''),
          sku: variant.sku || p.sku || 'N/A',
          variantLabel: variant.label || 'Tiêu chuẩn',
          name: p.name || 'Sản phẩm',
          category: p.category || 'Trà',
          stock,
          price: Number(variant.price ?? p.price ?? 0),
          imageUrl,
          statusText: isOut ? 'Hết hàng' : 'Sắp hết hàng',
          statusClass: isOut ? 'out-of-stock' : 'low-stock'
        });
      });
    }
    lowStockAlerts.sort((a, b) => a.stock - b.stock);

    // 6. Top selling products aggregated from order items
    const productSalesMap = new Map();
    for (const o of filteredOrders) {
      const st = String(o.status || 'pending').toLowerCase();
      if (st === 'cancelled' || st === 'refunded') continue;

      if (Array.isArray(o.items)) {
        for (const item of o.items) {
          const key = item.sku || item.productId || item.name;
          if (!key) continue;

          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);
          const itemTotal = Number(item.total || (qty * price));

          const matchedProd = products.find(p => (item.sku && p.sku === item.sku) || (item.productId && String(p._id) === String(item.productId)) || p.name === item.name);
          const prodId = matchedProd ? String(matchedProd._id) : (item.productId ? String(item.productId) : (item.sku || ''));

          if (!productSalesMap.has(key)) {
            let img = item.image || '';
            if (img && img.startsWith('/products/image/')) {
              img = `http://localhost:3002${img}`;
            } else if (!img) {
              img = matchedProd ? normalizeImageUrl(matchedProd.thumbnail || `${matchedProd.sku}_THUMB`) : '/assets/images/products/74.png';
            }
            productSalesMap.set(key, {
              id: prodId,
              sku: item.sku || (matchedProd ? matchedProd.sku : 'N/A'),
              name: item.name || item.productName || (matchedProd ? matchedProd.name : 'Sản phẩm Floralia'),
              category: item.category || (matchedProd ? matchedProd.category : 'Trà thảo mộc'),
              image: img,
              unitsSold: 0,
              totalRevenue: 0
            });
          }

          const existing = productSalesMap.get(key);
          if (!existing.id && prodId) existing.id = prodId;
          existing.unitsSold += qty;
          existing.totalRevenue += itemTotal;
        }
      }
    }

    const topProducts = Array.from(productSalesMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);

    // 7. Revenue Timeline (Group by date for last 7 active intervals or days)
    // We group orders by day (DD/MM) to provide smooth chart visualization
    const dateMap = new Map();
    // Default last 7 days keys
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      dateMap.set(dayStr, { date: dayStr, revenue: 0, ordersCount: 0 });
    }

    for (const o of orders) {
      const st = String(o.status || 'pending').toLowerCase();
      if (st === 'cancelled' || st === 'refunded') continue;

      const orderD = parseOrderDate(o);
      const dayStr = `${String(orderD.getDate()).padStart(2, '0')}/${String(orderD.getMonth() + 1).padStart(2, '0')}`;
      if (dateMap.has(dayStr)) {
        const entry = dateMap.get(dayStr);
        entry.revenue += Number(o.total || 0);
        entry.ordersCount += 1;
      }
    }

    // If orders are older or sparsely distributed, also add any day with orders
    if (Array.from(dateMap.values()).every(v => v.ordersCount === 0)) {
      dateMap.clear();
      for (const o of orders.slice(0, 10)) {
        const orderD = parseOrderDate(o);
        const dayStr = `${String(orderD.getDate()).padStart(2, '0')}/${String(orderD.getMonth() + 1).padStart(2, '0')}`;
        if (!dateMap.has(dayStr)) {
          dateMap.set(dayStr, { date: dayStr, revenue: 0, ordersCount: 0 });
        }
        const entry = dateMap.get(dayStr);
        entry.revenue += Number(o.total || 0);
        entry.ordersCount += 1;
      }
    }

    const revenueTimeline = Array.from(dateMap.values());

    // 8. Recent orders (10 items to fill table height cleanly)
    const recentOrders = orders.slice(0, 10).map(o => {
      let st = String(o.status || 'pending').toLowerCase();
      if (st === 'waiting') st = 'processing';
      if (st === 'completed') st = 'delivered';

      const statusLabels = {
        pending: 'Chờ xác nhận',
        processing: 'Chờ lấy hàng',
        shipping: 'Đang vận chuyển',
        delivered: 'Đã giao',
        cancelled: 'Đã hủy',
        refunded: 'Đã hoàn tiền'
      };

      const receiver = o.receiver || o.customer || o.sender || {};
      const firstItem = Array.isArray(o.items) && o.items.length > 0 ? o.items[0] : null;

      let firstItemImage = firstItem?.image || '';
      if (firstItemImage && firstItemImage.startsWith('/products/image/')) {
        firstItemImage = `http://localhost:3002${firstItemImage}`;
      } else if (!firstItemImage) {
        firstItemImage = '/assets/images/products/74.png';
      }
      const matchedProd = firstItem ? products.find(p => (firstItem.sku && p.sku === firstItem.sku) || (firstItem.productId && String(p._id) === String(firstItem.productId)) || p.name === firstItem.name) : null;
      const firstItemProductId = matchedProd ? String(matchedProd._id) : (firstItem?.productId ? String(firstItem.productId) : (firstItem?.sku || ''));

      let paymentStatus = o.paymentStatus;
      if (!paymentStatus) {
        paymentStatus = (st === 'delivered' || st === 'completed') ? 'paid' : 'unpaid';
      }

      return {
        id: String(o.id || o._id || ''),
        code: String(o.code || (o.id ? `#${o.id}` : '#ORD')),
        date: o.date || new Date().toLocaleDateString('vi-VN'),
        time: o.time || '10:00',
        customerName: receiver.name || 'Khách vãng lai',
        customerPhone: receiver.phone || '',
        firstItemName: firstItem ? (firstItem.name || firstItem.productName) : 'Sản phẩm',
        firstItemImage,
        firstItemProductId,
        itemCount: Array.isArray(o.items) ? o.items.length : 1,
        total: Number(o.total || 0),
        status: st,
        statusLabel: statusLabels[st] || 'Chờ xác nhận',
        paymentStatus,
        paymentStatusLabel: paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'
      };
    });

    // 9. Order status distribution
    const statusDistribution = [
      {
        status: 'pending',
        label: 'Chờ xác nhận',
        count: pendingOrders,
        percentage: totalOrders > 0 ? Math.round((pendingOrders / totalOrders) * 1000) / 10 : 0,
        color: '#e6a23c'
      },
      {
        status: 'processing',
        label: 'Chờ lấy hàng',
        count: processingOrders,
        percentage: totalOrders > 0 ? Math.round((processingOrders / totalOrders) * 1000) / 10 : 0,
        color: '#3498db'
      },
      {
        status: 'shipping',
        label: 'Đang vận chuyển',
        count: shippingOrders,
        percentage: totalOrders > 0 ? Math.round((shippingOrders / totalOrders) * 1000) / 10 : 0,
        color: '#8e44ad'
      },
      {
        status: 'delivered',
        label: 'Đã giao hàng',
        count: deliveredOrders,
        percentage: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 1000) / 10 : 0,
        color: '#18543b'
      },
      {
        status: 'cancelled',
        label: 'Đã hủy',
        count: cancelledOrders,
        percentage: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 1000) / 10 : 0,
        color: '#b5453f'
      }
    ];

    // 10. Summary response
    res.json({
      success: true,
      data: {
        summary: {
          totalRevenue,
          deliveredRevenue,
          totalOrders,
          pendingOrders,
          processingOrders,
          shippingOrders,
          deliveredOrders,
          cancelledOrders,
          completionRate,
          totalProducts: products.length,
          inStockProducts,
          lowStockProducts,
          outOfStockProducts,
          totalCustomers: users.length,
          activeCustomers: users.filter(u => !u.isBlocked && u.status !== 'blocked').length,
          totalBlogs: blogs.length,
          totalVouchers: vouchers.length
        },
        revenueTimeline,
        recentOrders,
        topProducts,
        lowStockAlerts: lowStockAlerts.slice(0, 6),
        statusDistribution
      }
    });
  } catch (err) {
    console.error('Lỗi getDashboardData:', err);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy dữ liệu tổng quan.'
    });
  }
}

module.exports = {
  getDashboardData
};
