import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrderDetail } from './order-detail';

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

describe('OrderDetail', () => {
  let component: OrderDetail;
  let fixture: ComponentFixture<OrderDetail>;
  let http: HttpTestingController;

  const mockOrder = {
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
      customerId: '#KH102',
    },
    items: [
      { name: 'Lục Mễ Trà', variant: 'Hộp 50g', price: 95000, quantity: 1, total: 95000 },
      { name: 'Lam hoa trà', variant: 'Hộp 100g', price: 75000, quantity: 1, total: 75000 },
      { name: 'Liên hoa trà', variant: 'Túi lọc 20 gói', price: 90000, quantity: 2, total: 180000 },
    ],
    subtotal: 350000,
    discount: 0,
    shippingFee: 0,
    total: 350000,
    shippingUnit: 'Giao Hàng Nhanh',
    trackingCode: 'GHN8842',
    trackingTimeline: [
      { title: 'Đang giao đến khách', time: '10/10 - 08:40', completed: true },
      { title: 'Đã xác nhận đơn', time: '09/10 - 09:20', completed: true },
    ],
    notes: [
      { text: 'Yêu cầu gói quà, giao giờ hành chính.', author: 'Khách hàng', date: '09/10' },
    ],
  };

  beforeEach(() => {
    const storage = createStorage();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
    Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
    localStorage.setItem('adminToken', 'test-admin-token');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, OrderDetail],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'FL0009' })),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(OrderDetail);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    localStorage.removeItem('adminToken');
  });

  it('loads and displays order detail matching #FL0009', () => {
    const req = http.expectOne('https://floralia-1.onrender.com/api/admin/orders/FL0009');
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-admin-token');

    req.flush({ success: true, order: mockOrder });
    fixture.detectChanges();

    expect(component.order).not.toBeNull();
    expect(component.order?.code).toBe('#FL0009');
    expect(component.order?.receiver.name).toBe('Thu Hà');
    expect(component.order?.items.length).toBe(3);
    expect(component.order?.total).toBe(350000);
    expect(component.order?.status).toBe('shipping');
  });

  it('updates order status to processing on confirmOrder', () => {
    http.expectOne('https://floralia-1.onrender.com/api/admin/orders/FL0009').flush({
      success: true,
      order: mockOrder,
    });
    fixture.detectChanges();

    component.confirmOrder();

    const patchReq = http.expectOne('https://floralia-1.onrender.com/api/admin/orders/FL0009/status');
    expect(patchReq.request.method).toBe('PATCH');
    expect(patchReq.request.body).toEqual({ status: 'processing', statusLabel: 'Chờ lấy hàng' });

    patchReq.flush({
      success: true,
      order: { ...mockOrder, status: 'processing', statusLabel: 'Chờ lấy hàng' },
    });
    fixture.detectChanges();

    expect(component.order?.status).toBe('processing');
  });

  it('adds a new note to the order notes list', () => {
    http.expectOne('https://floralia-1.onrender.com/api/admin/orders/FL0009').flush({
      success: true,
      order: mockOrder,
    });
    fixture.detectChanges();

    component.newNoteText = 'Đã gọi điện xác nhận địa chỉ giao hàng';
    component.submitAddNote();

    const noteReq = http.expectOne('https://floralia-1.onrender.com/api/admin/orders/FL0009/notes');
    expect(noteReq.request.method).toBe('POST');
    expect(noteReq.request.body).toEqual({
      text: 'Đã gọi điện xác nhận địa chỉ giao hàng',
      author: 'Admin',
    });

    noteReq.flush({
      success: true,
      note: { text: 'Đã gọi điện xác nhận địa chỉ giao hàng', author: 'Admin', date: '10/10' },
    });
    fixture.detectChanges();

    expect(component.order?.notes?.length).toBe(2);
    expect(component.newNoteText).toBe('');
  });

  it('opens and closes the invoice preview modal', () => {
    http.expectOne('https://floralia-1.onrender.com/api/admin/orders/FL0009').flush({
      success: true,
      order: mockOrder,
    });
    fixture.detectChanges();

    expect(component.invoiceModalVisible).toBe(false);
    component.openInvoiceModal();
    expect(component.invoiceModalVisible).toBe(true);

    component.closeInvoiceModal();
    expect(component.invoiceModalVisible).toBe(false);
  });
});

