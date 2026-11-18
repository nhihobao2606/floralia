import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap, timeout } from 'rxjs/operators';

export type CategoryLevel = 'main' | 'sub';

export interface AdminCategory {
  _id: string;
  code: string;
  name: string;
  slug: string;
  level: CategoryLevel;
  parentCode: string;
  parentName: string;
  visible: boolean;
  productCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminCategoryStats {
  total: number;
  main: number;
  sub: number;
  hidden: number;
}

export interface MainCategoryOption {
  _id: string;
  code: string;
  name: string;
  slug: string;
}

export interface AdminCategoryList {
  data: AdminCategory[];
  total: number;
  stats: AdminCategoryStats;
  mainCategories: MainCategoryOption[];
}

export interface CategoryFormValue {
  code: string;
  name: string;
  parentName: string;
  parentCode: string;
  visible: boolean;
  productCount?: number;
}

@Injectable({ providedIn: 'root' })
export class AdminCategoryService {
  private readonly apiUrl = 'http://localhost:3002/api/admin/products/categories';
  private categoryListCache: AdminCategoryList | null = null;

  constructor(private readonly http: HttpClient) {}

  slugify(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  getCachedList(): AdminCategoryList | null { return this.categoryListCache; }

  getInitialList(): AdminCategoryList {
    return this.categoryListCache || {
      data: [], total: 0,
      stats: { total: 0, main: 0, sub: 0, hidden: 0 },
      mainCategories: [],
    };
  }

  getCachedCategory(id: string): AdminCategory | undefined {
    return this.categoryListCache?.data.find(item => item._id === id);
  }

  cacheList(list: AdminCategoryList): void { this.categoryListCache = list; }
  invalidateCache(): void { this.categoryListCache = null; }

  getAll(): Observable<AdminCategoryList> {
    return this.http.get<AdminCategoryList>(this.apiUrl, { headers: this.authHeaders() }).pipe(
      timeout({ first: 8000 }),
      tap(list => { this.categoryListCache = list; })
    );
  }

  getById(id: string): Observable<AdminCategory> {
    return this.http.get<AdminCategory>(`${this.apiUrl}/${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    });
  }

  create(payload: CategoryFormValue): Observable<AdminCategory> {
    return this.http.post<AdminCategory>(this.apiUrl, payload, { headers: this.authHeaders() }).pipe(
      tap(() => this.invalidateCache())
    );
  }

  update(id: string, payload: CategoryFormValue): Observable<AdminCategory> {
    return this.http.put<AdminCategory>(`${this.apiUrl}/${encodeURIComponent(id)}`, payload, {
      headers: this.authHeaders(),
    }).pipe(tap(() => this.invalidateCache()));
  }

  toggleVisibility(id: string, visible: boolean): Observable<AdminCategory> {
    return this.http.patch<AdminCategory>(
      `${this.apiUrl}/${encodeURIComponent(id)}/visibility`, { visible }, { headers: this.authHeaders() }
    ).pipe(tap(() => this.invalidateCache()));
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    }).pipe(tap(() => this.invalidateCache()));
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}
