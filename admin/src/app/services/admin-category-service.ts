import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap, timeout } from 'rxjs/operators';
import { AdminProduct, AdminProductService } from './admin-product-service';

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

const STORAGE_KEY = 'floralia_admin_categories_v1';

const DEFAULT_CATEGORIES_SEED: Array<Omit<AdminCategory, 'slug' | 'productCount'>> = [
  { _id: 'cat-dm01', code: 'DM01', name: 'Trà thảo mộc', level: 'main', parentCode: '', parentName: '', visible: true },
  { _id: 'cat-dm01-01', code: 'DM01-01', name: 'Thanh lọc – Mát gan', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true },
  { _id: 'cat-dm01-02', code: 'DM01-02', name: 'Dưỡng nhan – Cân bằng nội tiết', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true },
  { _id: 'cat-dm01-03', code: 'DM01-03', name: 'Giảm stress – Ngủ ngon', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true },
  { _id: 'cat-dm01-04', code: 'DM01-04', name: 'Thanh tâm – Dưỡng thần', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true },
  { _id: 'cat-dm01-05', code: 'DM01-05', name: 'Bổ khí huyết – Dưỡng sinh', level: 'sub', parentCode: 'DM01', parentName: 'Trà thảo mộc', visible: true },
  { _id: 'cat-dm02', code: 'DM02', name: 'Trà thảo mộc mix', level: 'main', parentCode: '', parentName: '', visible: true },
  { _id: 'cat-dm02-01', code: 'DM02-01', name: 'Thanh lọc – Mát gan', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true },
  { _id: 'cat-dm02-02', code: 'DM02-02', name: 'Dưỡng nhan – Cân bằng nội tiết', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true },
  { _id: 'cat-dm02-03', code: 'DM02-03', name: 'Giảm stress – Ngủ ngon', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true },
  { _id: 'cat-dm02-04', code: 'DM02-04', name: 'Thanh tâm – Dưỡng thần', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true },
  { _id: 'cat-dm02-05', code: 'DM02-05', name: 'Bổ khí huyết – Dưỡng sinh', level: 'sub', parentCode: 'DM02', parentName: 'Trà thảo mộc mix', visible: true },
  { _id: 'cat-dm03', code: 'DM03', name: 'Ấm trà', level: 'main', parentCode: '', parentName: '', visible: true },
  { _id: 'cat-dm04', code: 'DM04', name: 'Đồ uống kèm trà', level: 'main', parentCode: '', parentName: '', visible: true },
  { _id: 'cat-dm05', code: 'DM05', name: 'Set quà tặng', level: 'main', parentCode: '', parentName: '', visible: true },
];

@Injectable({ providedIn: 'root' })
export class AdminCategoryService {
  private readonly apiUrl = 'http://localhost:3002/api/admin/products/categories';
  private categoryListCache: AdminCategoryList | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly productService: AdminProductService,
  ) {}

  slugify(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private extractBenefitTokens(name: string): string[] {
    const full = this.slugify(name);
    const parts = String(name || '')
      .split(/[–—-]/)
      .map(part => this.slugify(part))
      .filter(Boolean);
    return Array.from(new Set([full, ...parts].filter(Boolean)));
  }

  private countProductsForCategory(category: Omit<AdminCategory, 'productCount'>, products: AdminProduct[]): number {
    if (!Array.isArray(products) || !products.length) return 0;
    const catSlug = this.slugify(category.name);

    if (category.level === 'main') {
      return products.filter(product => {
        const pCatSlug = this.slugify(product.categorySlug || product.category);
        const pCatNameSlug = this.slugify(product.category);
        return pCatSlug === catSlug || pCatNameSlug === catSlug;
      }).length;
    }

    const parentSlug = this.slugify(category.parentName);
    const tokens = this.extractBenefitTokens(category.name);
    return products.filter(product => {
      if (parentSlug) {
        const pCatSlug = this.slugify(product.categorySlug || product.category);
        const pCatNameSlug = this.slugify(product.category);
        if (pCatSlug !== parentSlug && pCatNameSlug !== parentSlug) {
          return false;
        }
      }
      const subSlug = this.slugify(product.subCategory);
      if (subSlug && (subSlug === catSlug || tokens.includes(subSlug))) {
        return true;
      }
      const usageSlugs = Array.isArray(product.usage) ? product.usage.map(u => this.slugify(u)) : [];
      const benefitSlugs = Array.isArray(product.benefits) ? product.benefits.map(b => this.slugify(b)) : [];
      const tagSlugs = Array.isArray(product.tags) ? product.tags.map(t => this.slugify(t)) : [];
      const allProductTokens = [...usageSlugs, ...benefitSlugs, ...tagSlugs];
      return tokens.some(token => allProductTokens.includes(token));
    }).length;
  }

  private readLocalCategories(): Array<Omit<AdminCategory, 'productCount'>> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    const seeded = DEFAULT_CATEGORIES_SEED.map(item => ({
      ...item,
      slug: this.slugify(item.name),
    }));
    this.writeLocalCategories(seeded);
    return seeded;
  }

  private writeLocalCategories(items: Array<Omit<AdminCategory, 'productCount'>>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  }

  private sortCategoriesHierarchically(categories: Array<Omit<AdminCategory, 'productCount'>>): Array<Omit<AdminCategory, 'productCount'>> {
    const mains = categories
      .filter(c => c.level === 'main')
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi', { numeric: true }));
    const subs = categories
      .filter(c => c.level !== 'main')
      .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'vi', { numeric: true }));

    const result: Array<Omit<AdminCategory, 'productCount'>> = [];
    const usedSubIds = new Set<string>();

    for (const main of mains) {
      result.push(main);
      const children = subs.filter(
        sub =>
          (sub.parentCode && sub.parentCode === main.code) ||
          (sub.parentName && this.slugify(sub.parentName) === this.slugify(main.name))
      );
      for (const child of children) {
        result.push(child);
        usedSubIds.add(child._id);
      }
    }

    for (const sub of subs) {
      if (!usedSubIds.has(sub._id)) {
        result.push(sub);
      }
    }
    return result;
  }

  private buildCategoryListFromProducts(products: AdminProduct[]): AdminCategoryList {
    const stored = this.readLocalCategories();

    // Sync any new main categories that exist on products in MongoDB
    const existingMainSlugs = new Set(
      stored.filter(c => c.level === 'main').map(c => this.slugify(c.name))
    );
    let nextMainNum =
      Math.max(
        5,
        ...stored
          .filter(c => c.level === 'main')
          .map(c => {
            const m = /^DM(\d+)$/i.exec(c.code);
            return m ? Number.parseInt(m[1], 10) : 0;
          })
      ) + 1;

    let updatedStored = false;
    for (const product of products) {
      const catName = String(product.category || '').trim();
      const catSlug = this.slugify(catName);
      if (catName && catName !== 'Chưa phân loại' && !existingMainSlugs.has(catSlug)) {
        existingMainSlugs.add(catSlug);
        const code = `DM${String(nextMainNum++).padStart(2, '0')}`;
        stored.push({
          _id: `cat-${code.toLowerCase()}`,
          code,
          name: catName,
          slug: catSlug,
          level: 'main',
          parentCode: '',
          parentName: '',
          visible: true,
        });
        updatedStored = true;
      }
    }
    if (updatedStored) {
      this.writeLocalCategories(stored);
    }

    const sorted = this.sortCategoriesHierarchically(stored);
    const enriched: AdminCategory[] = sorted.map(item => ({
      ...item,
      slug: item.slug || this.slugify(item.name),
      visible: item.visible !== false,
      productCount: this.countProductsForCategory(item, products),
    }));

    const mainList = enriched.filter(c => c.level === 'main');
    const subList = enriched.filter(c => c.level !== 'main');
    const uniqueSubCount = new Set(subList.map(c => this.slugify(c.name))).size;
    const hiddenCount = enriched.filter(c => !c.visible).length;

    const list: AdminCategoryList = {
      data: enriched,
      total: enriched.length,
      stats: {
        total: enriched.length,
        main: mainList.length,
        sub: uniqueSubCount,
        hidden: hiddenCount,
      },
      mainCategories: mainList.map(c => ({
        _id: c._id,
        code: c.code,
        name: c.name,
        slug: c.slug,
      })),
    };
    this.categoryListCache = list;
    return list;
  }

  getCachedList(): AdminCategoryList | null {
    return this.categoryListCache;
  }

  getInitialList(): AdminCategoryList {
    if (this.categoryListCache) {
      return this.categoryListCache;
    }
    const cachedProducts = this.productService.getCachedList()?.data || [];
    return this.buildCategoryListFromProducts(cachedProducts);
  }

  getCachedCategory(id: string): AdminCategory | undefined {
    return this.categoryListCache?.data.find(item => item._id === id);
  }

  cacheList(list: AdminCategoryList): void {
    this.categoryListCache = list;
  }

  invalidateCache(): void {
    this.categoryListCache = null;
  }

  getAll(): Observable<AdminCategoryList> {
    return this.http
      .get<AdminCategoryList>(this.apiUrl, { headers: this.authHeaders() })
      .pipe(
        timeout({ first: 8000 }),
        tap(list => {
          if (list?.data?.length) {
            this.writeLocalCategories(list.data);
            this.categoryListCache = list;
          }
        }),
        catchError(() => {
          const cachedProducts = this.productService.getCachedList()?.data;
          if (cachedProducts?.length) {
            return of(this.buildCategoryListFromProducts(cachedProducts));
          }
          return this.productService
            .getAll({ page: 1, limit: 100, query: '', category: 'all', status: 'all' })
            .pipe(
              map(res => {
                this.productService.cacheList(res);
                return this.buildCategoryListFromProducts(res.data || []);
              }),
              catchError(() => of(this.buildCategoryListFromProducts([])))
            );
        })
      );
  }

  getById(id: string): Observable<AdminCategory> {
    return this.http
      .get<AdminCategory>(`${this.apiUrl}/${encodeURIComponent(id)}`, {
        headers: this.authHeaders(),
      })
      .pipe(
        catchError(() =>
          this.getAll().pipe(
            map(list => {
              const found = list.data.find(item => item._id === id || item.code === id);
              if (!found) {
                throw new Error('Không tìm thấy danh mục.');
              }
              return found;
            })
          )
        )
      );
  }

  create(payload: CategoryFormValue): Observable<AdminCategory> {
    this.invalidateCache();
    const stored = this.readLocalCategories();
    const code = payload.code.trim().toUpperCase();
    if (stored.some(item => item.code.toUpperCase() === code)) {
      return new Observable(subscriber => {
        subscriber.error({ error: { message: 'Mã danh mục đã tồn tại.' } });
      });
    }
    const parent = payload.parentName
      ? stored.find(item => item.level === 'main' && item.name === payload.parentName)
      : undefined;
    const newItem: AdminCategory = {
      _id: `cat-${Date.now()}`,
      code,
      name: payload.name.trim(),
      slug: this.slugify(payload.name),
      level: payload.parentName ? 'sub' : 'main',
      parentCode: payload.parentName ? parent?.code || payload.parentCode || '' : '',
      parentName: payload.parentName ? parent?.name || payload.parentName : '',
      visible: payload.visible !== false,
      productCount: 0,
    };
    stored.push(newItem);
    this.writeLocalCategories(stored);
    this.http.post<AdminCategory>(this.apiUrl, payload, { headers: this.authHeaders() }).pipe(catchError(() => of(null))).subscribe();
    return of(newItem);
  }

  update(id: string, payload: CategoryFormValue): Observable<AdminCategory> {
    this.invalidateCache();
    const stored = this.readLocalCategories();
    const idx = stored.findIndex(item => item._id === id || item.code === payload.code);
    if (idx < 0) {
      return new Observable(subscriber => {
        subscriber.error({ error: { message: 'Không tìm thấy danh mục.' } });
      });
    }
    const code = payload.code.trim().toUpperCase();
    if (stored.some((item, i) => i !== idx && item.code.toUpperCase() === code)) {
      return new Observable(subscriber => {
        subscriber.error({ error: { message: 'Mã danh mục đã tồn tại.' } });
      });
    }
    const existing = stored[idx];
    const parent = payload.parentName
      ? stored.find(item => item.level === 'main' && item._id !== id && item.name === payload.parentName)
      : undefined;
    const updated: AdminCategory = {
      ...existing,
      code,
      name: payload.name.trim(),
      slug: this.slugify(payload.name),
      level: payload.parentName ? 'sub' : 'main',
      parentCode: payload.parentName ? parent?.code || payload.parentCode || '' : '',
      parentName: payload.parentName ? parent?.name || payload.parentName : '',
      visible: payload.visible !== false,
      productCount: payload.productCount ?? 0,
    };
    stored[idx] = updated;
    if (existing.level === 'main' && (existing.code !== updated.code || existing.name !== updated.name)) {
      for (const item of stored) {
        if (item.parentCode === existing.code) {
          item.parentCode = updated.code;
          item.parentName = updated.name;
        }
      }
    }
    this.writeLocalCategories(stored);
    this.http.put<AdminCategory>(`${this.apiUrl}/${encodeURIComponent(id)}`, payload, { headers: this.authHeaders() }).pipe(catchError(() => of(null))).subscribe();
    return of(updated);
  }

  toggleVisibility(id: string, visible: boolean): Observable<AdminCategory> {
    this.invalidateCache();
    const stored = this.readLocalCategories();
    const target = stored.find(item => item._id === id);
    if (target) {
      target.visible = visible;
      if (target.level === 'main') {
        for (const item of stored) {
          if (item.parentCode === target.code) {
            item.visible = visible;
          }
        }
      }
      this.writeLocalCategories(stored);
    }
    this.http
      .patch<AdminCategory>(`${this.apiUrl}/${encodeURIComponent(id)}/visibility`, { visible }, { headers: this.authHeaders() })
      .pipe(catchError(() => of(null)))
      .subscribe();
    return of(target ? { ...target, productCount: 0 } : ({ _id: id, visible } as AdminCategory));
  }

  delete(id: string): Observable<{ success: boolean }> {
    this.invalidateCache();
    const stored = this.readLocalCategories();
    const target = stored.find(item => item._id === id);
    const filtered = stored.filter(
      item => item._id !== id && !(target?.level === 'main' && item.parentCode === target.code)
    );
    this.writeLocalCategories(filtered);
    this.http.delete<{ success: boolean }>(`${this.apiUrl}/${encodeURIComponent(id)}`, { headers: this.authHeaders() }).pipe(catchError(() => of(null))).subscribe();
    return of({ success: true });
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}
