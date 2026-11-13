import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { StockError, StockService } from './stock.service';

describe('StockService', () => {
  let service: StockService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/stock`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(StockService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists the warehouses', async () => {
    const warehouses = firstValueFrom(service.getWarehouses());

    const request = http.expectOne(`${baseUrl}/warehouses`);
    expect(request.request.method).toBe('GET');
    request.flush([{ id: 'w1', code: 'MAIN', name: 'Main', active: true }]);

    expect((await warehouses).length).toBe(1);
  });

  it('creates a warehouse with an upper case code', async () => {
    const created = firstValueFrom(service.createWarehouse({ code: 'main', name: 'Main' }));

    const request = http.expectOne(`${baseUrl}/warehouses`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ code: 'main', name: 'Main' });
    request.flush({ id: 'w1', code: 'MAIN', name: 'Main', active: true });

    expect((await created).code).toBe('MAIN');
  });

  it('keeps the error code returned by the API', async () => {
    const failure = firstValueFrom(service.createWarehouse({ code: 'MAIN', name: 'Main' }));

    http
      .expectOne(`${baseUrl}/warehouses`)
      .flush(
        { message: 'a warehouse with this code already exists', code: 'warehouseExists' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(failure).rejects.toMatchObject({ code: 'warehouseExists' });
  });

  it('reads the stock levels with the filters', async () => {
    const levels = firstValueFrom(service.getLevels({ warehouseId: 'w1', search: 'laptop' }));

    const request = http.expectOne(
      (req) =>
        req.url === `${baseUrl}/levels` &&
        req.params.get('warehouseId') === 'w1' &&
        req.params.get('search') === 'laptop',
    );
    request.flush([{ productId: 'p1', name: 'Laptop', quantity: 3, low: false }]);

    expect((await levels)[0].name).toBe('Laptop');
  });

  it('asks the API for one page of movements', async () => {
    const page = firstValueFrom(
      service.getMovements({ page: 1, size: 10, search: 'FAC', type: 'sale', sort: 'date,desc' }),
    );

    const request = http.expectOne(
      (req) =>
        req.url === `${baseUrl}/movements` &&
        req.params.get('page') === '1' &&
        req.params.get('type') === 'sale' &&
        req.params.get('search') === 'FAC',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [{ id: 'sm1', direction: 'out' }], total: 1, page: 1, size: 10 });

    expect((await page).items[0].direction).toBe('out');
  });

  it('records an adjustment', async () => {
    const created = firstValueFrom(
      service.createAdjustment({
        direction: 'in',
        productId: 'p1',
        warehouseId: 'w1',
        quantity: 10,
        date: '2026-10-21',
        reason: 'Opening inventory',
      }),
    );

    const request = http.expectOne(`${baseUrl}/adjustments`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.quantity).toBe(10);
    request.flush({ id: 'sm1', direction: 'in', quantity: 10 });

    expect((await created).id).toBe('sm1');
  });

  it('moves the stock and returns the two movements', async () => {
    const created = firstValueFrom(
      service.createTransfer({
        productId: 'p1',
        fromWarehouseId: 'w1',
        toWarehouseId: 'w2',
        quantity: 4,
        date: '2026-10-22',
        reason: 'Moving',
      }),
    );

    const request = http.expectOne(`${baseUrl}/transfers`);
    expect(request.request.method).toBe('POST');
    request.flush([
      { id: 'sm1', direction: 'out' },
      { id: 'sm2', direction: 'in' },
    ]);

    const movements = await created;
    expect(movements.length).toBe(2);
    expect(movements[1].direction).toBe('in');
  });

  it('checks the availability of a list of products', async () => {
    const issues = firstValueFrom(
      service.checkAvailability('w1', [
        { productId: 'p1', quantity: 5 },
        { productId: null, quantity: 2 },
      ]),
    );

    const request = http.expectOne(`${baseUrl}/availability`);
    expect(request.request.body.items.length).toBe(1);
    request.flush([{ productId: 'p1', required: 5, available: 1 }]);

    expect((await issues)[0].available).toBe(1);
  });

  it('refuses a sale posting without enough stock', async () => {
    const failure = firstValueFrom(
      service.recordSalePosting({
        refId: 'FAC-1',
        date: '2026-10-23',
        warehouseId: 'w1',
        items: [{ productId: 'p1', quantity: 5 }],
      }),
    );

    http
      .expectOne(`${baseUrl}/sales-postings`)
      .flush(
        { message: 'not enough stock to post the invoice', code: 'insufficientStock' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(failure).rejects.toBeInstanceOf(StockError);
    await expect(failure).rejects.toMatchObject({ code: 'insufficientStock' });
  });
});
