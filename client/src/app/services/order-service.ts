import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface OrderItem {
  sku: string;
  name: string;
  image: string;
  variant?: string;
  price: number;
  oldPrice?: number;
  quantity: number;
  total: number;
}

export interface OrderAddress {
  name: string;
  address: string;
  email: string;
  phone: string;
}

export interface Order {
  id: string;
  code: string;
  date: string;
  time?: string;
  status: 'pending' | 'shipping' | 'waiting' | 'completed' | 'delivered' | 'cancelled' | 'refunded' | 'processing';
  statusLabel: string;
  step: number; // 1: Nhận đơn, 2: Đang xử lý, 3: Đang trên đường giao, 4: Đã giao
  notice?: string;
  paymentMethod: string;
  sender?: OrderAddress;
  receiver?: OrderAddress;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  refundAmount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly apiUrl = 'http://localhost:3002/api/orders';

  private readonly defaultOrders: Order[] = [
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
          name: 'Huyết Ngọc Trà ~ Trà Bổ Huyết Dưỡng Nhan',
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

  constructor(private http: HttpClient) {}

  getOrders(status?: string, query?: string): Observable<Order[]> {
    return this.http.get<{ success: boolean; orders: Order[] }>(this.apiUrl, {
      params: {
        ...(status && status !== 'all' ? { status } : {}),
        ...(query ? { q: query } : {})
      }
    }).pipe(
      map(res => res.orders),
      catchError(() => {
        let list = [...this.defaultOrders];
        if (status && status !== 'all') {
          list = list.filter(o => {
            if (status === 'waiting') return o.status === 'shipping';
            return o.status === status;
          });
        }
        if (query) {
          const q = query.trim().toLowerCase();
          list = list.filter(o =>
            o.id.toLowerCase().includes(q) ||
            o.code.toLowerCase().includes(q) ||
            o.items.some(i => i.name.toLowerCase().includes(q))
          );
        }
        return of(list);
      })
    );
  }

  getOrderByIdSync(id: string): Order {
    const found = this.defaultOrders.find(o => o.id === id || o.code === ('#' + id) || o.id === '4152');
    return found || this.defaultOrders[0];
  }

  saveOrderLocal(orderData: Partial<Order>): Order {
    const id = orderData.id || '4152';
    const newOrder: Order = {
      id,
      code: orderData.code || ('#' + id),
      date: orderData.date || new Date().toLocaleDateString('vi-VN'),
      time: orderData.time || new Date().toLocaleTimeString('vi-VN'),
      status: orderData.status || 'processing',
      statusLabel: orderData.statusLabel || 'ĐANG XỬ LÝ',
      step: orderData.step || 2,
      paymentMethod: orderData.paymentMethod || 'Paypal',
      sender: orderData.sender || {
        name: 'Hà Anh',
        address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
        email: 'Haanh.BD@gmail.com',
        phone: '(671) 555-0110'
      },
      receiver: orderData.receiver || {
        name: 'Minh Trần',
        address: '12C, Võ Thị Sáu, Hà Tĩnh',
        email: 'MinhTran.thuu@gmail.com',
        phone: '(671) 555-0110'
      },
      items: orderData.items || [],
      subtotal: orderData.subtotal || 700000,
      discount: orderData.discount || 155000,
      shippingFee: orderData.shippingFee || 0,
      total: orderData.total || 545000
    };

    const idx = this.defaultOrders.findIndex(o => o.id === id || o.code === ('#' + id));
    if (idx >= 0) {
      this.defaultOrders[idx] = newOrder;
    } else {
      this.defaultOrders.unshift(newOrder);
    }
    return newOrder;
  }

  getOrderById(id: string): Observable<Order | null> {
    return this.http.get<{ success: boolean; order: Order }>(`${this.apiUrl}/${id}`).pipe(
      map(res => res.order),
      catchError(() => {
        const found = this.defaultOrders.find(o => o.id === id || o.code === `#${id}`);
        return of(found || this.defaultOrders[0]);
      })
    );
  }

  getDefaultOrders(): Order[] {
    return JSON.parse(JSON.stringify(this.defaultOrders));
  }

  createOrder(orderData: Partial<Order>): Observable<{ success: boolean; order: Order }> {
    return this.http.post<{ success: boolean; order: Order }>(this.apiUrl, orderData).pipe(
      map(res => {
        if (res.order) {
          this.defaultOrders.unshift(res.order);
        }
        return res;
      }),
      catchError(() => {
        const id = orderData.id || String(Math.floor(1000 + Math.random() * 9000));
        const newOrder: Order = {
          id,
          code: orderData.code || ('#' + id),
          date: orderData.date || new Date().toLocaleDateString('vi-VN'),
          time: orderData.time || new Date().toLocaleTimeString('vi-VN'),
          status: orderData.status || 'processing',
          statusLabel: orderData.statusLabel || 'ĐANG XỬ LÝ',
          step: orderData.step || 2,
          paymentMethod: orderData.paymentMethod || 'Paypal',
          sender: orderData.sender || {
            name: 'Hà Anh',
            address: '11A Bế Văn Đàn, Dĩ An, Bình Dương',
            email: 'Haanh.BD@gmail.com',
            phone: '(671) 555-0110'
          },
          receiver: orderData.receiver || {
            name: 'Minh Trần',
            address: '12C, Võ Thị Sáu, Hà Tĩnh',
            email: 'MinhTran.thuu@gmail.com',
            phone: '(671) 555-0110'
          },
          items: orderData.items || [],
          subtotal: orderData.subtotal || 0,
          discount: orderData.discount || 0,
          shippingFee: orderData.shippingFee || 0,
          total: orderData.total || 0
        };
        this.defaultOrders.unshift(newOrder);
        return of({ success: true, order: newOrder });
      })
    );
  }

  updateOrderStatus(id: string, status: Order['status'], statusLabel: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}`, { status, statusLabel }).pipe(
      catchError(() => {
        const found = this.defaultOrders.find(o => o.id === id || o.code === `#${id}`);
        if (found) {
          found.status = status;
          found.statusLabel = statusLabel;
        }
        return of({ success: true });
      })
    );
  }

  formatPrice(num: number): string {
    return (num || 0).toLocaleString('vi-VN') + 'đ';
  }
}
