import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Blog } from '../classes/Blog';

export interface BlogResponse {
  data: Blog[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private apiUrl = 'https://floralia-1.onrender.com/blogs';

  constructor(private http: HttpClient) {}

  getAll(params?: { category?: string; featured?: boolean; q?: string; page?: number; limit?: number }): Observable<BlogResponse> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.category && params.category !== 'all') {
        httpParams = httpParams.set('category', params.category);
      }
      if (params.featured !== undefined) {
        httpParams = httpParams.set('featured', String(params.featured));
      }
      if (params.q && params.q.trim()) {
        httpParams = httpParams.set('q', params.q.trim());
      }
      if (params.page) {
        httpParams = httpParams.set('page', String(params.page));
      }
      if (params.limit) {
        httpParams = httpParams.set('limit', String(params.limit));
      }
    }
    return this.http.get<BlogResponse>(this.apiUrl, { params: httpParams });
  }

  getFeatured(): Observable<BlogResponse> {
    return this.getAll({ featured: true });
  }

  getByIdentifier(identifier: string): Observable<Blog> {
    return this.http.get<Blog>(`${this.apiUrl}/${encodeURIComponent(identifier)}`);
  }
}
