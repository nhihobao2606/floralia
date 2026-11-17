export interface GuestOrderItem {
  sku?: string;
  name: string;
  image: string;
  variant?: string;
  price: number;
  oldPrice?: number;
  quantity: number;
  total: number;
}

export interface GuestOrder {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  createdAt?: string;
  date?: string;
  time?: string;
  paymentMethod: string;
  shippingUnit: string;
  trackingCode: string;
  trackingTimeline: Array<{ title: string; time: string; completed: boolean }>;
  notice: string;
  receiver: { name: string; phone: string; email: string; address: string };
  subtotal: number;
  productDiscount: number;
  voucherDiscount: number;
  voucherCode?: string;
  shippingFee: number;
  total: number;
  items: GuestOrderItem[];
}
