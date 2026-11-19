import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: 'customer' | 'admin';
  status: 'active' | 'blocked';
  isBlocked: boolean;
  createdAt?: string | null;
  totalSpent?: number;
  orderCount?: number;
}

export interface AdminUsersSummary {
  total: number;
  active: number;
  blocked: number;
}

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly apiUrl = 'https://floralia-1.onrender.com/api/users';
  private cachedUsers: { success: boolean; users: AdminUser[]; summary: AdminUsersSummary } | null = null;

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<{ success: boolean; token?: string; user?: { role?: string }; message?: string }> {
    return this.http.post<{ success: boolean; token?: string; user?: { role?: string }; message?: string }>(
      'https://floralia-1.onrender.com/api/auth/login',
      { email, password }
    );
  }

  ensureAdminSession(): Observable<boolean> {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    if (token) {
      return of(true);
    }

    return this.login('floraliatea@gmail.com', 'floralia123').pipe(
      map((result) => {
        if (!result.success || !result.token || result.user?.role !== 'admin') {
          return false;
        }

        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        sessionStorage.removeItem('adminToken');
        sessionStorage.removeItem('adminUser');
        sessionStorage.setItem('adminToken', result.token);
        sessionStorage.setItem('adminUser', JSON.stringify(result.user));
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  getAll(forceReload = false): Observable<{ success: boolean; users: AdminUser[]; summary: AdminUsersSummary }> {
    if (!forceReload && this.cachedUsers) {
      return of(this.cachedUsers);
    }

    return this.http.get<{ success: boolean; users: AdminUser[]; summary: AdminUsersSummary }>(
      `${this.apiUrl}/admin/list`,
      { headers: this.authHeaders() }
    ).pipe(
      map((response) => {
        this.cachedUsers = response;
        return response;
      })
    );
  }

  toggleStatus(id: string, action: 'block' | 'unblock', reason = ''): Observable<{ success: boolean; message: string; user: AdminUser }> {
    return this.http.patch<{ success: boolean; message: string; user: AdminUser }>(
      `${this.apiUrl}/admin/${encodeURIComponent(id)}/status`,
      { action, reason },
      { headers: this.authHeaders() }
    ).pipe(map((response) => {
      if (response?.user && this.cachedUsers) {
        const users = this.cachedUsers.users.map((user) => user.id === response.user.id ? { ...user, ...response.user } : user);
        this.cachedUsers = {
          success: true,
          users,
          summary: {
            total: users.length,
            active: users.filter((user) => user.status !== 'blocked').length,
            blocked: users.filter((user) => user.status === 'blocked').length,
          },
        };
      }
      return response;
    }));
  }

  updateProfile(id: string, payload: { fullName?: string; phone?: string; avatar?: string; role?: 'customer' | 'admin' }): Observable<{ success: boolean; message: string; user: AdminUser }> {
    return this.http.patch<{ success: boolean; message: string; user: AdminUser }>(
      `${this.apiUrl}/admin/${encodeURIComponent(id)}`,
      payload,
      { headers: this.authHeaders() }
    ).pipe(
      map((response) => {
        if (response?.user) {
          const currentUsers = this.cachedUsers?.users ?? [];
          this.cachedUsers = {
            success: true,
            users: currentUsers.map((user) => user.id === response.user.id ? response.user : user),
            summary: this.cachedUsers?.summary ?? { total: currentUsers.length, active: 0, blocked: 0 },
          };
          this.cachedUsers.summary = {
            total: this.cachedUsers.users.length,
            active: this.cachedUsers.users.filter((user) => user.status !== 'blocked').length,
            blocked: this.cachedUsers.users.filter((user) => user.status === 'blocked').length,
          };
        }
        return response;
      })
    );
  }

  createUser(payload: { fullName: string; email: string; phone: string; password: string; role: 'customer' | 'admin'; avatar?: string; status?: 'active' | 'blocked' }): Observable<{ success: boolean; message: string; user: AdminUser }> {
    return this.http.post<{ success: boolean; message: string; user: AdminUser }>(
      `${this.apiUrl}/admin`, payload, { headers: this.authHeaders() }
    ).pipe(map(response => {
      this.cachedUsers = null;
      return response;
    }));
  }

  clearCache(): void {
    this.cachedUsers = null;
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}

