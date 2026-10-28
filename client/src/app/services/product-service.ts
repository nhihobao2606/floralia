import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Products } from '../classes/Products';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:3002/products';

  constructor(private http: HttpClient) {}

  getAll(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }
  // Lấy danh sách sản phẩm
  getProducts(): Observable<Products[]> {
    return this.http.get<Products[]>(this.apiUrl);
  }

  // Lấy chi tiết 1 sản phẩm theo Slug
  getProductBySlug(slug: string): Observable<Products> {
    return this.http.get<Products>(`${this.apiUrl}/slug/${slug}`);
  }
}
