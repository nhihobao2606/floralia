import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AdminOrder, AdminOrderService } from './admin-order-service';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe('AdminOrderService', () => {
  let service: AdminOrderService;
  let http: HttpTestingController;

  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    localStorage.setItem('adminToken', 'test-admin-token');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdminOrderService],
    });

    service = TestBed.inject(AdminOrderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('adminToken');
  });

  it('fetches order list with query parameters and auth headers', () => {
    const mockOrder: AdminOrder = {
      id: 'FL0011',
      code: '#FL0011',
      date: '10/10/2026',
      status: 'pending',
      statusLabel: 'Chờ xác nhận',
      step: 1,
      paymentMethod: 'COD',
      paymentStatus: 'unpaid',
      paymentStatusLabel: 'Chưa thanh toán',
      receiver: {
        name: 'Minh Hoàng',
        phone: '0909 050 909',
        address: '341 Cao Đạt',
      },
      items: [
        { name: 'Trà hoa cúc', price: 50000, quantity: 2, total: 100000 },
      ],
      subtotal: 100000,
      discount: 0,
      shippingFee: 0,
      total: 100000,
    };

    service.getAll({ page: 1, limit: 5, status: 'pending', query: 'Minh' }).subscribe(res => {
      expect(res.orders.length).toBe(1);
      expect(res.orders[0].code).toBe('#FL0011');
      expect(res.total).toBe(1);
      expect(res.stats.pending).toBe(1);
    });

    const req = http.expectOne(request =>
      request.url === 'http://localhost:3002/api/admin/orders' &&
      request.params.get('page') === '1' &&
      request.params.get('limit') === '5' &&
      request.params.get('status') === 'pending' &&
      request.params.get('q') === 'Minh'
    );
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-admin-token');

    req.flush({
      success: true,
      orders: [mockOrder],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, pending: 1, processing: 0, shipping: 0, delivered: 0, cancelled: 0 },
    });
  });

  it('gets order detail by ID', () => {
    service.getById('FL0009').subscribe(res => {
      expect(res.success).toBe(true);
      expect(res.order.id).toBe('FL0009');
    });

    const req = http.expectOne('http://localhost:3002/api/admin/orders/FL0009');
    req.flush({
      success: true,
      order: {
        id: 'FL0009',
        code: '#FL0009',
        date: '09/10/2026',
        status: 'shipping',
        statusLabel: 'Đang giao hàng',
        step: 3,
        paymentMethod: 'VNPay',
        paymentStatus: 'paid',
        paymentStatusLabel: 'Đã thanh toán',
        receiver: { name: 'Thu Hà', phone: '0987 654 321', address: '88 Lê Lợi' },
        items: [],
        subtotal: 350000,
        discount: 0,
        shippingFee: 0,
        total: 350000,
      },
    });
  });

  it('updates order status', () => {
    service.updateStatus('FL0011', 'processing', 'Đang chuẩn bị').subscribe(res => {
      expect(res.success).toBe(true);
      expect(res.order.status).toBe('processing');
    });

    const req = http.expectOne('http://localhost:3002/api/admin/orders/FL0011/status');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'processing', statusLabel: 'Đang chuẩn bị' });

    req.flush({
      success: true,
      order: {
        id: 'FL0011',
        code: '#FL0011',
        status: 'processing',
        statusLabel: 'Đang chuẩn bị',
      },
    });
  });

  it('adds a note to an order', () => {
    service.addNote('FL0009', 'Yêu cầu gói quà', 'Khách hàng').subscribe(res => {
      expect(res.success).toBe(true);
      expect(res.note.text).toBe('Yêu cầu gói quà');
    });

    const req = http.expectOne('http://localhost:3002/api/admin/orders/FL0009/notes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'Yêu cầu gói quà', author: 'Khách hàng' });

    req.flush({
      success: true,
      note: { text: 'Yêu cầu gói quà', author: 'Khách hàng', date: '09/10' },
    });
  });

  it('deletes an order', () => {
    service.deleteOrder('FL0007').subscribe(res => {
      expect(res.success).toBe(true);
    });

    const req = http.expectOne('http://localhost:3002/api/admin/orders/FL0007');
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: 'Đã xóa đơn hàng thành công.' });
  });

  it('bulk deletes orders', () => {
    service.bulkDelete(['FL0007', 'FL0008']).subscribe(res => {
      expect(res.success).toBe(true);
    });

    const req = http.expectOne('http://localhost:3002/api/admin/orders/bulk-delete');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ids: ['FL0007', 'FL0008'] });
    req.flush({ success: true, message: 'Đã xóa 2 đơn hàng thành công.' });
  });
});
