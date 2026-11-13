import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { apiErrorCode } from '../../../core/services/api-error';
import { Page } from '../../../shared/models/page';
import {
  AdjustmentInput,
  AvailabilityIssue,
  ReceptionPostingInput,
  SalePostingInput,
  StockLevelQuery,
  StockLevelRow,
  StockMovement,
  StockMovementQuery,
  StockMovementRow,
  TransferInput,
} from '../models/stock-movement';
import {
  Warehouse,
  WarehouseInput,
  WarehouseNameInput,
  WarehouseSummary,
} from '../models/warehouse';

export type StockErrorCode =
  | 'notFound'
  | 'missingCode'
  | 'missingName'
  | 'warehouseExists'
  | 'lastActiveWarehouse'
  | 'invalidQuantity'
  | 'missingProduct'
  | 'notStockedProduct'
  | 'missingWarehouse'
  | 'inactiveWarehouse'
  | 'sameWarehouse'
  | 'missingReason'
  | 'insufficientStock'
  | 'invalidType'
  | 'invalidDirection';

const STOCK_ERROR_CODES: StockErrorCode[] = [
  'notFound',
  'missingCode',
  'missingName',
  'warehouseExists',
  'lastActiveWarehouse',
  'invalidQuantity',
  'missingProduct',
  'notStockedProduct',
  'missingWarehouse',
  'inactiveWarehouse',
  'sameWarehouse',
  'missingReason',
  'insufficientStock',
  'invalidType',
  'invalidDirection',
];

export class StockError extends Error {
  constructor(readonly code: StockErrorCode) {
    super(code);
  }
}

/** Warehouses and the stock journal, served by the stock API. */
@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/stock`;

  getWarehouses(): Observable<Warehouse[]> {
    return this.http
      .get<Warehouse[]>(`${this.baseUrl}/warehouses`)
      .pipe(catchError(this.fail));
  }

  createWarehouse(data: WarehouseInput): Observable<Warehouse> {
    return this.http
      .post<Warehouse>(`${this.baseUrl}/warehouses`, data)
      .pipe(catchError(this.fail));
  }

  updateWarehouse(id: string, data: WarehouseNameInput): Observable<Warehouse> {
    return this.http
      .put<Warehouse>(`${this.baseUrl}/warehouses/${id}`, data)
      .pipe(catchError(this.fail));
  }

  archiveWarehouse(id: string): Observable<Warehouse> {
    return this.http
      .patch<Warehouse>(`${this.baseUrl}/warehouses/${id}/archive`, {})
      .pipe(catchError(this.fail));
  }

  restoreWarehouse(id: string): Observable<Warehouse> {
    return this.http
      .patch<Warehouse>(`${this.baseUrl}/warehouses/${id}/restore`, {})
      .pipe(catchError(this.fail));
  }

  getLevels(query: StockLevelQuery): Observable<StockLevelRow[]> {
    let params = new HttpParams();
    if (query.warehouseId) params = params.set('warehouseId', query.warehouseId);
    if (query.search) params = params.set('search', query.search);

    return this.http
      .get<StockLevelRow[]>(`${this.baseUrl}/levels`, { params })
      .pipe(catchError(this.fail));
  }

  getLowStockLevels(): Observable<StockLevelRow[]> {
    return this.http
      .get<StockLevelRow[]>(`${this.baseUrl}/low-stock`)
      .pipe(catchError(this.fail));
  }

  getWarehouseSummaries(): Observable<WarehouseSummary[]> {
    return this.http
      .get<WarehouseSummary[]>(`${this.baseUrl}/summaries`)
      .pipe(catchError(this.fail));
  }

  getMovements(query: StockMovementQuery): Observable<Page<StockMovementRow>> {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.search) params = params.set('search', query.search);
    if (query.type) params = params.set('type', query.type);
    if (query.warehouseId) params = params.set('warehouseId', query.warehouseId);
    if (query.sort) params = params.set('sort', query.sort);

    return this.http
      .get<Page<StockMovementRow>>(`${this.baseUrl}/movements`, { params })
      .pipe(catchError(this.fail));
  }

  createAdjustment(data: AdjustmentInput): Observable<StockMovement> {
    return this.http
      .post<StockMovement>(`${this.baseUrl}/adjustments`, data)
      .pipe(catchError(this.fail));
  }

  createTransfer(data: TransferInput): Observable<StockMovement[]> {
    return this.http
      .post<StockMovement[]>(`${this.baseUrl}/transfers`, data)
      .pipe(catchError(this.fail));
  }

  checkAvailability(
    warehouseId: string,
    items: { productId: string | null; quantity: number }[],
  ): Observable<AvailabilityIssue[]> {
    return this.http
      .post<AvailabilityIssue[]>(`${this.baseUrl}/availability`, {
        warehouseId,
        items: items
          .filter((item) => item.productId !== null)
          .map((item) => ({ productId: item.productId, quantity: item.quantity })),
      })
      .pipe(catchError(this.fail));
  }

  recordPurchaseReception(data: ReceptionPostingInput): Observable<StockMovement[]> {
    return this.http
      .post<StockMovement[]>(`${this.baseUrl}/receptions`, data)
      .pipe(catchError(this.fail));
  }

  recordSalePosting(data: SalePostingInput): Observable<StockMovement[]> {
    return this.http
      .post<StockMovement[]>(`${this.baseUrl}/sales-postings`, data)
      .pipe(catchError(this.fail));
  }

  /** Turns an API failure into a StockError the pages can translate. */
  private readonly fail = (error: unknown): Observable<never> => {
    const code = apiErrorCode(error);
    if (code && STOCK_ERROR_CODES.includes(code as StockErrorCode)) {
      return throwError(() => new StockError(code as StockErrorCode));
    }
    return throwError(() => (error instanceof Error ? error : new Error('request failed')));
  };
}
