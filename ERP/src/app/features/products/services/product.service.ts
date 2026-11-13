import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { apiCodeError, apiErrorCode } from '../../../core/services/api-error';
import { Page } from '../../../shared/models/page';
import { Product, ProductInput, ProductQuery } from '../models/product';

/** The product catalog, served by the products API. */
@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/products`;

  getProducts(query: ProductQuery): Observable<Page<Product>> {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.search) params = params.set('search', query.search);
    if (query.type) params = params.set('type', query.type);
    if (query.category) params = params.set('category', query.category);
    if (query.active !== undefined) params = params.set('active', query.active);
    if (query.sort) params = params.set('sort', query.sort);

    return this.http.get<Page<Product>>(this.baseUrl, { params });
  }

  getProduct(id: string): Observable<Product | undefined> {
    return this.http.get<Product>(`${this.baseUrl}/${id}`).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(undefined)
          : throwError(() => this.toError(error)),
      ),
    );
  }

  createProduct(data: ProductInput): Observable<Product> {
    return this.http
      .post<Product>(this.baseUrl, { ...data, minStock: data.minStock ?? 0 })
      .pipe(catchError(this.fail));
  }

  updateProduct(id: string, data: ProductInput): Observable<Product> {
    return this.http
      .put<Product>(`${this.baseUrl}/${id}`, { ...data, minStock: data.minStock ?? 0 })
      .pipe(catchError(this.fail));
  }

  archiveProduct(id: string): Observable<Product> {
    return this.http
      .patch<Product>(`${this.baseUrl}/${id}/archive`, {})
      .pipe(catchError(this.fail));
  }

  restoreProduct(id: string): Observable<Product> {
    return this.http
      .patch<Product>(`${this.baseUrl}/${id}/restore`, {})
      .pipe(catchError(this.fail));
  }

  private readonly fail = (error: unknown): Observable<never> =>
    throwError(() => this.toError(error));

  /** Turns an API failure into an error carrying the machine code. */
  private toError(error: unknown): Error {
    const code = apiErrorCode(error);
    if (code) {
      return apiCodeError(code);
    }
    return error instanceof Error ? error : new Error('request failed');
  }
}
