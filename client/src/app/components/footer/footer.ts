import { Component } from '@angular/core';

@Component({
  selector: 'app-footer',
  standalone: false,
  styleUrl: './footer.css',
  templateUrl: './footer.html',
})
export class Footer {
  year = new Date().getFullYear();
 
  services = [
    { icon: 'bi-flower2', title: '100% Thảo mộc tự nhiên', desc: 'Được tuyển chọn kỹ lưỡng từ các nguồn nguyên liệu chất lượng' },
    { icon: 'bi-truck', title: 'Giao hàng toàn quốc', desc: 'Nhanh chóng và tiện lợi' },
    { icon: 'bi-headset', title: 'Hỗ trợ tận tâm 24/7', desc: 'Tư vấn khi cần thiết' },
    { icon: 'bi-box-seam', title: 'Đảm bảo chất lượng', desc: 'Đảm bảo sản phẩm đạt tiêu chuẩn trước khi đến tay khách hàng' },
  ];
}
