import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { apiErrorCode } from '../../../core/services/api-error';
import { Page } from '../../../shared/models/page';
import {
  PurchaseDraftInput,
  PurchaseOrder,
  PurchaseQuery,
  PurchaseSummary,
  ReceiveInput,
} from '../models/purchase-order';

export type PurchaseErrorCode =
  | 'notFound'
  | 'notDraft'
  | 'notConfirmed'
  | 'noLines'
  | 'missingSupplier'
  | 'expectedDateBeforeOrder'
  | 'hasReceptions'
  | 'invalidReceiveQty'
  | 'alreadyComplete'
  | 'cancelledOrder';

const PURCHASE_ERROR_CODES: PurchaseErrorCode[] = [
  'notFound',
  'notDraft',
  'notConfirmed',
  'noLines',
  'missingSupplier',
  'expectedDateBeforeOrder',
  'hasReceptions',
  'invalidReceiveQty',
  'alreadyComplete',
  'cancelledOrder',
];

export class PurchaseError extends Error {
  constructor(readonly code: PurchaseErrorCode) {
    super(code);
  }
}

/** The purchase orders, served by the purchases API. */
@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/purchases`;

  getOrders(query: PurchaseQuery): Observable<Page<PurchaseOrder>> {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    if (query.sort) params = params.set('sort', query.sort);

    return this.http
      .get<Page<PurchaseOrder>>(this.baseUrl, { params })
      .pipe(catchError(this.fail));
  }

  getOrder(id: string): Observable<PurchaseOrder | undefined> {
    return this.http.get<PurchaseOrder>(`${this.baseUrl}/${id}`).pipe(
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(undefined)
          : throwError(() => this.toError(error)),
      ),
    );
  }

  getSummary(): Observable<PurchaseSummary> {
    return this.http
      .get<PurchaseSummary>(`${this.baseUrl}/summary`)
      .pipe(catchError(this.fail));
  }

  /** Creates the order when it has no id, updates it otherwise. */
  saveDraft(data: PurchaseDraftInput): Observable<PurchaseOrder> {
    const body = {
      supplierId: data.supplierId,
      orderDate: data.orderDate,
      expectedDate: data.expectedDate,
      paymentTerms: data.paymentTerms,
      currency: data.currency,
      notes: data.notes,
      lines: data.lines,
    };

    const request = data.id
      ? this.http.put<PurchaseOrder>(`${this.baseUrl}/${data.id}`, body)
      : this.http.post<PurchaseOrder>(this.baseUrl, body);

    return request.pipe(catchError(this.fail));
  }

  confirmOrder(id: string): Observable<PurchaseOrder> {
    return this.http
      .post<PurchaseOrder>(`${this.baseUrl}/${id}/confirm`, {})
      .pipe(catchError(this.fail));
  }

  cancelOrder(id: string): Observable<PurchaseOrder> {
    return this.http
      .post<PurchaseOrder>(`${this.baseUrl}/${id}/cancel`, {})
      .pipe(catchError(this.fail));
  }

  /** Copies an order into a new editable draft. */
  duplicateOrder(id: string): Observable<PurchaseOrder> {
    return this.http
      .post<PurchaseOrder>(`${this.baseUrl}/${id}/duplicate`, {})
      .pipe(catchError(this.fail));
  }

  /** Records a delivery note; the API also moves the stock. */
  receiveOrder(id: string, input: ReceiveInput): Observable<PurchaseOrder> {
    return this.http
      .post<PurchaseOrder>(`${this.baseUrl}/${id}/receptions`, input)
      .pipe(catchError(this.fail));
  }

  deleteDraft(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(catchError(this.fail));
  }

  /** Turns an API failure into a PurchaseError the pages can translate. */
  private readonly fail = (error: unknown): Observable<never> =>
    throwError(() => this.toError(error));

  private toError(error: unknown): Error {
    const code = apiErrorCode(error);
    if (code && PURCHASE_ERROR_CODES.includes(code as PurchaseErrorCode)) {
      return new PurchaseError(code as PurchaseErrorCode);
    }
    return error instanceof Error ? error : new Error('request failed');
  }
}
