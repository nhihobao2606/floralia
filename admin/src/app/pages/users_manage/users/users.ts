import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, finalize, of, timeout } from 'rxjs';
import { AdminSidebar } from '../../../components/admin-sidebar/admin-sidebar';
import { AdminUser, AdminUserService } from '../../../services/admin-user-service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminSidebar],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class AdminUsers implements OnInit {
  users: AdminUser[] = [];
  loading = false;
  error = '';
  success = '';
  searchTerm = '';
  filter = 'all';
  currentPage = 1;
  readonly pageSize = 7;
  modalOpen = false;
  selectedUser: AdminUser | null = null;
  selectedUserProfile: AdminUser | null = null;
  action: 'block' | 'unblock' = 'block';
  lockReason = 'Nghi vấn đơn hàng ảo';
  readonly reasonOptions = ['Nghi vấn đơn hàng ảo', 'Khách hàng vi phạm chính sách', 'Yêu cầu bảo mật', 'Khác'];
  updatingId: string | null = null;
  editingProfile = false;
  profileDraft = { fullName: '', phone: '', avatar: '' };
  summary = { total: 0, active: 0, blocked: 0 };
  adminName = 'Admin Floralia';

  constructor(
    private readonly userService: AdminUserService,
    private readonly router: Router,
    private readonly changeDetector: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

    if (!token) {
      this.loading = false;
      this.error = 'Phiên đăng nhập quản trị đã hết hạn. Vui lòng đăng nhập lại.';
      void this.router.navigate(['/admin-login']);
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';
    this.changeDetector.detectChanges();

    this.userService.getAll().pipe(
      timeout(20000),
      catchError((error) => {
        const message = error?.error?.message || 'Không thể tải danh sách người dùng.';
        this.error = message;
        this.users = [];
        this.summary = { total: 0, active: 0, blocked: 0 };
        return of({ success: false, users: [], summary: { total: 0, active: 0, blocked: 0 } });
      }),
      finalize(() => {
        this.loading = false;
        this.changeDetector.detectChanges();
      }),
    ).subscribe((response) => {
      this.users = (response.users || []).map(user => ({ ...user, role: user.role === 'admin' ? 'admin' : 'customer' }));
      this.summary = response.summary || this.buildSummary(this.users);
      if (this.users.length > 0 && this.error === '') {
        this.loading = false;
      }
      this.changeDetector.detectChanges();
    });
  }

  get filteredUsersList(): AdminUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const normalizedRole = user.role === 'admin' ? 'admin' : 'customer';
      const matchesFilter = this.filter === 'all'
        || (this.filter === 'customer' && normalizedRole === 'customer')
        || (this.filter === 'admin' && normalizedRole === 'admin')
        || (this.filter === 'active' && user.status !== 'blocked')
        || (this.filter === 'blocked' && user.status === 'blocked');

      if (!matchesFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (user.fullName || '').toLowerCase().includes(term)
        || (user.email || '').toLowerCase().includes(term)
        || (user.phone || '').toLowerCase().includes(term);
    });
  }

  get paginatedUsers(): AdminUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsersList.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsersList.length / this.pageSize));
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) this.currentPage = page;
  }

  getInitials(fullName: string): string {
    if (!fullName) return 'U';
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'U';
  }

  getAvatarSrc(avatar?: string): string | null {
    if (!avatar || !avatar.trim()) {
      return null;
    }
    return avatar.trim();
  }

  openUserProfile(user: AdminUser): void {
    void this.router.navigate(['/users', user.id]);
  }

  closeUserProfile(): void {
    this.selectedUserProfile = null;
    this.editingProfile = false;
  }

  openEditProfile(user: AdminUser): void {
    void this.router.navigate(['/users', user.id, 'edit']);
  }

  addUser(): void {
    void this.router.navigate(['/users/new']);
  }

  startEditProfile(): void {
    if (!this.selectedUserProfile) return;
    this.editingProfile = true;
    this.profileDraft = {
      fullName: this.selectedUserProfile.fullName || '',
      phone: this.selectedUserProfile.phone || '',
      avatar: this.selectedUserProfile.avatar || '',
    };
  }

  cancelEditProfile(): void {
    this.editingProfile = false;
    this.profileDraft = {
      fullName: this.selectedUserProfile?.fullName || '',
      phone: this.selectedUserProfile?.phone || '',
      avatar: this.selectedUserProfile?.avatar || '',
    };
  }

  saveProfileChanges(): void {
    if (!this.selectedUserProfile) return;

    const payload: { fullName?: string; phone?: string; avatar?: string } = {};
    if (this.profileDraft.fullName.trim()) {
      payload.fullName = this.profileDraft.fullName.trim();
    }
    if (this.profileDraft.phone.trim()) {
      payload.phone = this.profileDraft.phone.trim();
    }
    if (this.profileDraft.avatar.trim()) {
      payload.avatar = this.profileDraft.avatar.trim();
    }

    if (!Object.keys(payload).length) {
      this.editingProfile = false;
      return;
    }

    this.updatingId = this.selectedUserProfile.id;
    this.userService.updateProfile(this.selectedUserProfile.id, payload).subscribe({
      next: (response) => {
        this.users = this.users.map((user) => user.id === response.user.id ? response.user : user);
        this.selectedUserProfile = response.user;
        this.summary = this.buildSummary(this.users);
        this.success = response.message;
        this.updatingId = null;
        this.editingProfile = false;
        this.changeDetector.detectChanges();
      },
      error: (error) => {
        this.error = error?.error?.message || 'Không thể cập nhật thông tin người dùng.';
        this.updatingId = null;
        this.changeDetector.detectChanges();
      },
    });
  }

  openStatusModal(user: AdminUser): void {
    this.selectedUser = user;
    this.action = user.status === 'blocked' ? 'unblock' : 'block';
    this.modalOpen = true;
    this.error = '';
  }

  closeModal(): void {
    this.modalOpen = false;
    this.selectedUser = null;
  }

  confirmStatusChange(): void {
    if (!this.selectedUser || this.updatingId) return;
    const targetUser = this.selectedUser;
    this.updatingId = targetUser.id;
    this.error = '';
    this.success = this.action === 'block' ? 'Đang gửi yêu cầu khóa tài khoản...' : 'Đang gửi yêu cầu mở khóa tài khoản...';
    this.changeDetector.detectChanges();

    this.userService.toggleStatus(targetUser.id, this.action, this.lockReason).pipe(
      timeout(15000),
      finalize(() => {
        this.updatingId = null;
        this.changeDetector.detectChanges();
      }),
    ).subscribe({
      next: (response) => {
        this.users = this.users.map((user) => user.id === response.user.id ? response.user : user);
        this.summary = this.buildSummary(this.users);
        this.success = response.message;
        this.changeDetector.detectChanges();
        window.setTimeout(() => {
          this.closeModal();
          this.changeDetector.detectChanges();
        }, 1200);
      },
      error: (error) => {
        this.error = error?.error?.message || (error?.name === 'TimeoutError'
          ? 'Máy chủ phản hồi quá lâu. Hãy kiểm tra kết nối rồi thử lại.'
          : 'Không thể cập nhật trạng thái người dùng.');
        this.changeDetector.detectChanges();
      },
    });
  }

  private buildSummary(users: AdminUser[]) {
    return {
      total: users.length,
      active: users.filter((user) => user.status !== 'blocked').length,
      blocked: users.filter((user) => user.status === 'blocked').length,
    };
  }

  logout(): void {
    this.userService.clearCache();
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    void this.router.navigate(['/admin-login']);
  }
}
