import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminRecommendationService, RecommendationOverview, RecommendationSegment } from '../../services/admin-recommendation-service';
import { AdminSidebar } from '../../components/admin-sidebar/admin-sidebar';
import { AdminLogoutDialog } from '../../components/admin-logout-dialog/admin-logout-dialog';

@Component({
  selector: 'app-recommendations', standalone: true, imports: [CommonModule, FormsModule, RouterLink, AdminSidebar, AdminLogoutDialog],
  template: `<div class="layout"><app-admin-sidebar (logoutRequested)="requestLogoutConfirmation()"></app-admin-sidebar><app-admin-logout-dialog [visible]="logoutConfirmationVisible" (cancelled)="cancelLogoutConfirmation()" (confirmed)="confirmLogout()"></app-admin-logout-dialog><main><header class="topbar admin-standard-topbar"><h1>Gợi ý sản phẩm thông minh</h1><div class="topbar-right"><button class="topbar-bell" type="button" aria-label="Thông báo"><i class="bi bi-bell" aria-hidden="true"></i><span class="bell-badge">3</span></button><div class="admin-account"><a class="account-avatar-link" routerLink="/profile" title="Xem hồ sơ quản trị viên" aria-label="Hồ sơ quản trị viên"><span class="account-avatar">{{ (adminName || 'A').charAt(0).toUpperCase() }}</span></a><a class="account-copy profile-account-link" routerLink="/profile" aria-label="Hồ sơ quản trị viên"><strong>{{ adminName }}</strong><small>Quản trị viên</small></a><button type="button" class="topbar-logout" (click)="requestLogoutConfirmation()"><i class="bi bi-box-arrow-right"></i> Đăng xuất</button></div></div></header>
  <section class="intro"><div><span class="eyebrow">PRODUCT RECOMMENDATION</span><h2>Đúng sản phẩm, đúng khách hàng</h2><p>Hệ thống tự phân nhóm khách theo lịch sử đơn hàng. Chọn sản phẩm để hiển thị cho từng nhóm trên trang chủ.</p></div><div class="model">✦ <span>Phân khúc tự động<small>Cập nhật từ đơn hàng</small></span></div></section>
  <p class="notice" *ngIf="message">{{message}}</p><p class="error" *ngIf="error">{{error}}</p><div class="loading" *ngIf="loading">Đang phân tích dữ liệu khách hàng…</div>
  <ng-container *ngIf="!loading && overview"><div class="segment-tabs"><button *ngFor="let item of overview.segments" [class.selected]="active?.id === item.id" (click)="select(item)"><span>{{item.name}}</span><b>{{item.customerCount}}</b></button></div>
  <section class="workspace" *ngIf="active"><div class="products"><div class="section-head"><div><h3>{{active.name}}</h3><p>{{active.description}} · {{active.customerCount}} khách hàng</p></div><button class="save" (click)="save()" [disabled]="saving">{{saving ? 'Đang lưu…' : 'Lưu gợi ý'}}</button></div>
  <p class="hint">Đã chọn {{active.productSkus.length}} sản phẩm. Nếu chưa chọn, trang chủ sẽ tự hiển thị sản phẩm bán chạy.</p><div class="product-grid"><label class="product" *ngFor="let product of overview.products" [class.checked]="active.productSkus.includes(product.sku)"><input type="checkbox" [checked]="active.productSkus.includes(product.sku)" (change)="toggle(product.sku, $any($event.target).checked)"><span class="thumb">{{product.name.slice(0,1)}}</span><span class="copy"><b>{{product.name}}</b><small>{{product.category || product.sku}}</small><strong>{{product.price | number}}₫</strong></span></label></div>
  </div><aside><h3>Khách hàng trong nhóm</h3><div class="customer" *ngFor="let customer of active.customers | slice:0:8"><span class="avatar">{{customer.fullName.slice(0,1)}}</span><span><b>{{customer.fullName}}</b><small>{{customer.orderCount}} đơn · {{customer.totalSpent | number}}₫</small></span></div><div class="empty" *ngIf="!active.customers.length">Chưa có khách hàng trong phân khúc.</div></aside></section></ng-container></main></div>`,
  styles: [`.layout{display:flex;min-height:100vh;background:#f4f7f3;color:#263b30}main{min-width:0;flex:1}header{height:68px;padding:0 34px;background:#fff;border-bottom:1px solid #e7ede7;display:flex;align-items:center;justify-content:space-between}header small,.eyebrow{font-size:10px;letter-spacing:1.4px;color:#7b927e;font-weight:700}h1{font-size:18px;margin:3px 0;color:#204a35}header button{border:0;background:none;color:#526b58;cursor:pointer;font-size:14px}.intro{margin:24px 32px 18px;padding:26px 30px;border-radius:16px;background:linear-gradient(115deg,#dceadd,#eef4e9);display:flex;justify-content:space-between;align-items:center}.intro h2{margin:8px 0;color:#214c36;font-size:24px}.intro p{margin:0;color:#617366;font-size:14px}.model{display:flex;gap:12px;align-items:center;background:#fff9;padding:14px 18px;border-radius:12px;color:#338352}.model span{font-weight:700;font-size:14px}.model small{display:block;margin-top:4px;color:#829185;font-weight:400;font-size:13px}.notice,.error{margin:0 32px 12px;font-size:14px}.notice{color:#278452}.error{color:#b13c34}.loading{padding:30px;text-align:center;font-size:15px}.segment-tabs{display:flex;gap:10px;margin:0 32px 18px;overflow:auto}.segment-tabs button{border:1px solid #e2e9e1;border-radius:12px;background:#fff;padding:14px 17px;display:flex;align-items:center;gap:16px;white-space:nowrap;color:#526657;cursor:pointer;font-size:14px}.segment-tabs button.selected{border-color:#48845b;background:#edf5ec;color:#28583b}.segment-tabs b{border-radius:20px;background:#e8eee7;padding:3px 9px;font-size:13px}.workspace{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:16px;margin:0 32px 32px}.products,aside{background:white;border:1px solid #e7ede7;border-radius:14px;padding:20px}.section-head{display:flex;justify-content:space-between;align-items:center}.section-head h3,aside h3{margin:0;color:#284f38;font-size:18px}.section-head p,aside>p,.hint{font-size:14px;color:#809084}.save{border:0;border-radius:8px;padding:10px 16px;background:#276443;color:white;cursor:pointer;font-size:14px}.save:disabled{opacity:.6}.hint{padding:10px 12px;background:#f7f9f6;border-radius:8px}.product-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.product{display:flex;gap:10px;align-items:center;border:1px solid #e8ede8;border-radius:10px;padding:10px;cursor:pointer}.product.checked{border-color:#5a9366;background:#f3f8f1}.product input{accent-color:#327049}.thumb{width:42px;height:42px;flex:none;display:grid;place-items:center;border-radius:8px;background:#edf2e9;color:#4b7951;font-size:18px;font-weight:700}.copy{min-width:0;display:grid;gap:3px}.copy b,.customer b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.copy small,.customer small{font-size:12px;color:#859187}.copy strong{font-size:13px;color:#4d7354}.customer{display:flex;gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid #f0f2ef}.customer>span:last-child{min-width:0;display:grid;gap:4px}.avatar{width:32px;height:32px;display:grid;place-items:center;border-radius:50%;background:#e9f1e6;color:#37704b}.empty{padding:15px 0;color:#879288;font-size:14px}@media(max-width:1000px){.workspace{grid-template-columns:1fr}.intro{align-items:flex-start;gap:14px}.product-grid{grid-template-columns:1fr}}`]
})
export class Recommendations implements OnInit {
  adminName = 'Admin Floralia';
  logoutConfirmationVisible = false;
  overview: RecommendationOverview | null = null; active: RecommendationSegment | null = null;
  loading = true; saving = false; message = ''; error = '';
  constructor(private readonly service: AdminRecommendationService, private readonly router: Router, private readonly changeDetector: ChangeDetectorRef) {}
  ngOnInit(): void { const saved = localStorage.getItem('adminUser') || sessionStorage.getItem('adminUser'); if (saved) { try { const user = JSON.parse(saved); this.adminName = user.fullName || user.name || 'Admin Floralia'; } catch { this.adminName = 'Admin Floralia'; } } this.service.getOverview().subscribe({ next: data => { this.overview = data; this.active = data.segments[0] || null; this.loading = false; this.changeDetector.markForCheck(); }, error: error => { this.error = error.error?.message || 'Không tải được dữ liệu phân khúc.'; this.loading = false; this.changeDetector.markForCheck(); } }); }
  select(segment: RecommendationSegment): void { this.active = segment; this.message = ''; this.error = ''; }
  toggle(sku: string, checked: boolean): void { if (!this.active) return; const values = new Set(this.active.productSkus); checked ? values.add(sku) : values.delete(sku); this.active.productSkus = [...values].slice(0, 12); }
  save(): void {
    const segment = this.active;
    if (!segment) return;

    const requestedSkus = [...segment.productSkus];
    this.saving = true;
    this.message = '';
    this.error = '';
    this.service.save(segment.id, requestedSkus).subscribe({
      next: result => {
        this.service.getOverview().subscribe({
          next: overview => {
            const persistedSegment = overview.segments.find(item => item.id === segment.id);
            const persistedSkus = persistedSegment?.productSkus || [];
            const activeSegmentId = this.active?.id;
            this.overview = overview;
            this.active = overview.segments.find(item => item.id === activeSegmentId) || null;
            this.message = `Đã xác nhận lưu ${persistedSkus.length}${requestedSkus.length !== persistedSkus.length ? `/${requestedSkus.length}` : ''} sản phẩm cho phân khúc này.`;
            if (!persistedSegment || persistedSkus.length !== result.productSkus.length || persistedSkus.some((sku, index) => sku !== result.productSkus[index])) {
              this.error = 'Danh sách đọc lại từ máy chủ chưa khớp với kết quả lưu. Vui lòng tải lại trang quản trị.';
            }
            this.saving = false;
            this.changeDetector.markForCheck();
          },
          error: error => {
            this.error = error.error?.message || 'Đã gửi thao tác lưu nhưng không xác nhận lại được dữ liệu từ máy chủ.';
            this.saving = false;
            this.changeDetector.markForCheck();
          },
        });
      },
      error: error => {
        this.error = error.error?.message || 'Không thể lưu cài đặt.';
        this.saving = false;
        this.changeDetector.markForCheck();
      },
    });
  }
  requestLogoutConfirmation(): void { this.logoutConfirmationVisible = true; }
  cancelLogoutConfirmation(): void { this.logoutConfirmationVisible = false; }
  confirmLogout(): void { this.logoutConfirmationVisible = false; this.logout(); }
  logout(): void { for (const storage of [localStorage, sessionStorage]) { storage.removeItem('adminToken'); storage.removeItem('adminUser'); storage.removeItem('adminAuthSource'); } void this.router.navigate(['/admin-login']); }
}
