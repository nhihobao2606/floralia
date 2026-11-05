import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Orders } from './orders';

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

describe('Orders', () => {
  let component: Orders;
  let fixture: ComponentFixture<Orders>;
  let http: HttpTestingController;

  const mockOrder = {
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
    },
    items: [
      { name: 'Trà hoa cúc', price: 50000, quantity: 2, total: 100000 },
      { name: 'Trà Atisô đỏ', price: 85000, quantity: 1, total: 85000 },
    ],
    subtotal: 185000,
    discount: 0,
    shippingFee: 0,
    total: 185000,
  };

  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    localStorage.setItem('adminToken', 'test-admin-token');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, Orders],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(Orders);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('adminToken');
  });

  it('loads live orders and populates the 5 metric stat cards', () => {
    const req = http.expectOne(request =>
      request.url === 'http://localhost:3002/api/admin/orders' &&
      request.params.get('page') === '1' &&
      request.params.get('limit') === '5'
    );
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-admin-token');

    req.flush({
      success: true,
      orders: [mockOrder],
      total: 43,
      page: 1,
      limit: 5,
      stats: {
        total: 43,
        pending: 6,
        processing: 4,
        shipping: 3,
        delivered: 28,
        cancelled: 2,
      },
    });
    fixture.detectChanges();

    expect(component.orders.length).toBe(1);
    expect(component.orders[0].code).toBe('#FL0011');
    expect(component.stats.pending).toBe(6);
    expect(component.stats.processing).toBe(4);
    expect(component.stats.delivered).toBe(28);
    expect(component.total).toBe(43);
  });

  it('toggles metric status filter when clicking a status card', () => {
    http.expectOne(request => request.url === 'http://localhost:3002/api/admin/orders').flush({
      success: true,
      orders: [mockOrder],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, pending: 1, processing: 0, shipping: 0, delivered: 0, cancelled: 0 },
    });
    fixture.detectChanges();

    component.filterByStatus('delivered');
    expect(component.activeStatusFilter).toBe('delivered');

    const filterReq = http.expectOne(request =>
      request.url === 'http://localhost:3002/api/admin/orders' &&
      request.params.get('status') === 'delivered'
    );
    filterReq.flush({
      success: true,
      orders: [],
      total: 0,
      page: 1,
      limit: 5,
      stats: { total: 1, pending: 1, processing: 0, shipping: 0, delivered: 0, cancelled: 0 },
    });
    fixture.detectChanges();
    expect(component.orders.length).toBe(0);
  });

  it('handles order row checkbox selection and select all', () => {
    http.expectOne(request => request.url === 'http://localhost:3002/api/admin/orders').flush({
      success: true,
      orders: [mockOrder],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, pending: 1, processing: 0, shipping: 0, delivered: 0, cancelled: 0 },
    });
    fixture.detectChanges();

    expect(component.isSelected(component.orders[0])).toBe(false);
    component.toggleSelect(component.orders[0]);
    expect(component.isSelected(component.orders[0])).toBe(true);
    expect(component.isAllSelected()).toBe(true);

    component.toggleSelect(component.orders[0]);
    expect(component.isSelected(component.orders[0])).toBe(false);
  });

  it('confirms pending order and triggers quick status change', () => {
    http.expectOne(request => request.url === 'http://localhost:3002/api/admin/orders').flush({
      success: true,
      orders: [mockOrder],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, pending: 1, processing: 0, shipping: 0, delivered: 0, cancelled: 0 },
    });
    fixture.detectChanges();

    component.confirmOrder(component.orders[0]);

    const patchReq = http.expectOne('http://localhost:3002/api/admin/orders/FL0011/status');
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body.status).toBe('processing');
    patchReq.flush({
      success: true,
      order: { ...mockOrder, status: 'processing', statusLabel: 'Đang chuẩn bị' },
    });

    // It refreshes orders after status change
    http.expectOne(request => request.url === 'http://localhost:3002/api/admin/orders').flush({
      success: true,
      orders: [{ ...mockOrder, status: 'processing', statusLabel: 'Đang chuẩn bị' }],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, pending: 0, processing: 1, shipping: 0, delivered: 0, cancelled: 0 },
    });
    fixture.detectChanges();

    expect(component.orders[0].status).toBe('processing');
  });

  it('opens and closes the invoice preview dialog', () => {
    http.expectOne(request => request.url === 'http://localhost:3002/api/admin/orders').flush({
      success: true,
      orders: [mockOrder],
      total: 1,
      page: 1,
      limit: 5,
      stats: { total: 1, pending: 1, processing: 0, shipping: 0, delivered: 0, cancelled: 0 },
    });
    fixture.detectChanges();

    expect(component.invoiceOrder).toBeNull();
    component.printInvoice(component.orders[0]);
    expect(component.invoiceOrder).not.toBeNull();
    expect(component.invoiceOrder?.code).toBe('#FL0011');

    component.closeInvoice();
    expect(component.invoiceOrder).toBeNull();
  });

  it('opens and cancels the logout confirmation dialog', () => {
    http.expectOne(request => request.url === 'http://localhost:3002/api/admin/orders').flush({
      success: true,
      orders: [],
      total: 0,
      page: 1,
      limit: 5,
      stats: { total: 0, pending: 0, processing: 0, shipping: 0, delivered: 0, cancelled: 0 },
    });
    fixture.detectChanges();

    component.requestLogoutConfirmation();
    expect(component.logoutConfirmationVisible).toBe(true);

    component.cancelLogoutConfirmation();
    expect(component.logoutConfirmationVisible).toBe(false);
  });
});
