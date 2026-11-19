import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type BlogStatus = 'published' | 'draft' | 'archived';

export interface AdminBlog {
  _id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorRole?: string;
  category: string;
  categorySlug: string;
  image?: string;
  imageData?: string | null;
  imageMimeType?: string | null;
  imageFileName?: string | null;
  imageAlt?: string;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  date?: string;
  status: BlogStatus;
  views: number;
  featured?: boolean;
  readTime?: string;
  tags?: string[];
  metaTitle?: string;
  metaDescription?: string;
}

export interface BlogStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  views: number;
}

export interface BlogCategory {
  name: string;
  slug: string;
}

export interface AdminBlogListRow {
  _id: string;
  slug: string;
  title: string;
  category: string;
  publishedAt?: string | Date | null;
  date?: string;
  status: BlogStatus;
  views: number;
}

export interface AdminBlogList {
  data: AdminBlogListRow[];
  total: number;
  page: number;
  limit: number;
  stats: BlogStats;
}

export type BlogFormValue = Pick<
  AdminBlog,
  'title' | 'excerpt' | 'content' | 'author' | 'category' | 'image' | 'status'
> & {
  featured: boolean;
  categorySlug?: string;
  publishedAt?: string;
  imageData?: string;
  imageMimeType?: string;
  imageFileName?: string;
  imageAlt?: string;
  clearImageData?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
};

@Injectable({ providedIn: 'root' })
export class AdminBlogService {
  private readonly apiUrl = 'https://floralia-1.onrender.com/api/admin/blogs';

  constructor(private readonly http: HttpClient) {}

  getAll(options: { page: number; limit: number; status: string; query: string }): Observable<AdminBlogList> {
    let params = new HttpParams()
      .set('page', options.page)
      .set('limit', options.limit)
      .set('status', options.status);
    if (options.query.trim()) {
      params = params.set('q', options.query.trim());
    }

    return this.http.get<AdminBlogList>(this.apiUrl, {
      headers: this.authHeaders(),
      params,
    });
  }

  getById(id: string): Observable<AdminBlog> {
    return this.http.get<AdminBlog>(`${this.apiUrl}/${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    });
  }

  getCategories(): Observable<BlogCategory[]> {
    return this.http.get<BlogCategory[]>(`${this.apiUrl}/categories`, {
      headers: this.authHeaders(),
    });
  }

  getAuthors(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/authors`, {
      headers: this.authHeaders(),
    });
  }

  create(article: BlogFormValue): Observable<AdminBlog> {
    return this.http.post<AdminBlog>(this.apiUrl, article, {
      headers: this.authHeaders(),
    });
  }

  update(id: string, article: BlogFormValue): Observable<AdminBlog> {
    return this.http.put<AdminBlog>(`${this.apiUrl}/${encodeURIComponent(id)}`, article, {
      headers: this.authHeaders(),
    });
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${encodeURIComponent(id)}`, {
      headers: this.authHeaders(),
    });
  }

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
    return new HttpHeaders({ Authorization: `Bearer ${token || ''}` });
  }
}

