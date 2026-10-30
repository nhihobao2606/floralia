export interface CouponItem {
  id: string;
  discountBadge: string;
  title: string;
  desc: string;
  expiryDate: string;
  code: string;
  minOrder: string;
}

export const DEFAULT_COUPONS: CouponItem[] = [
  {
    id: 'cp1',
    discountBadge: 'GIẢM NGAY 10%',
    title: 'Giảm 10% đơn từ 199k',
    desc: 'Áp dụng cho mọi đơn hàng trà thảo mộc nguyên vị hoặc mix vị.',
    expiryDate: '1/8/2026',
    code: 'FLORA10',
    minOrder: '199.000đ',
  },
  {
    id: 'cp2',
    discountBadge: 'GIẢM NGAY 50K',
    title: 'Giảm 50K đơn từ 399k',
    desc: 'Áp dụng cho đơn hàng trà thảo mộc và phụ kiện ấm trà cao cấp.',
    expiryDate: '1/12/2026',
    code: 'FLORA50K',
    minOrder: '399.000đ',
  },
  {
    id: 'cp3',
    discountBadge: 'GIẢM NGAY 20%',
    title: 'Giảm 20% đơn từ 499k',
    desc: 'Áp dụng cho các set quà tặng trà thảo mộc và trà hộp gỗ.',
    expiryDate: '1/12/2026',
    code: 'FLORA20',
    minOrder: '499.000đ',
  },
  {
    id: 'cp4',
    discountBadge: 'GIẢM NGAY 15%',
    title: 'Giảm 15% đơn từ 299k',
    desc: 'Mã ưu đãi đặc quyền dành cho khách hàng mới trải nghiệm mua sắm.',
    expiryDate: '20/11/2026',
    code: 'FLORA15',
    minOrder: '299.000đ',
  },
];
