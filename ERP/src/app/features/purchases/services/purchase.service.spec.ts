import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PurchaseService } from './purchase.service';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/purchases`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PurchaseService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks the API for one filtered page of orders', async () => {
    const page = firstValueFrom(
      service.getOrders({
        page: 1,
        size: 10,
        search: 'nord',
        status: 'confirmed',
        sort: 'orderDate,desc',
      }),
    );

    const request = http.expectOne(
      (req) =>
        req.url === baseUrl &&
        req.params.get('page') === '1' &&
        req.params.get('size') === '10' &&
        req.params.get('search') === 'nord' &&
        req.params.get('status') === 'confirmed' &&
        req.params.get('sort') === 'orderDate,desc',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0, page: 1, size: 10 });

    await expect(page).resolves.toEqual({ items: [], total: 0, page: 1, size: 10 });
  });

  it('reads the summary of the dashboard', async () => {
    const summary = firstValueFrom(service.getSummary());

    const request = http.expectOne(`${baseUrl}/summary`);
    expect(request.request.method).toBe('GET');
    request.flush({ awaiting: 2, late: 1 });

    await expect(summary).resolves.toEqual({ awaiting: 2, late: 1 });
  });

  it('returns nothing when the order does not exist', async () => {
    const order = firstValueFrom(service.getOrder('missing'));

    const request = http.expectOne(`${baseUrl}/missing`);
    request.flush({ code: 'notFound' }, { status: 404, statusText: 'Not Found' });

    await expect(order).resolves.toBeUndefined();
  });

  it('creates a draft without the id of the form', async () => {
    const created = firstValueFrom(
      service.saveDraft({
        id: null,
        supplierId: 'supplier-1',
        orderDate: '2026-05-10',
        expectedDate: '2026-05-20',
        paymentTerms: 'net30',
        currency: 'USD',
        notes: '',
        lines: [
          {
            productId: null,
            reference: 'SKU-1',
            description: 'Mouse',
            unit: 'piece',
            quantity: 10,
            unitCost: 15,
            discountPct: 0,
            vatRate: 19,
          },
        ],
      }),
    );

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      supplierId: 'supplier-1',
      orderDate: '2026-05-10',
      expectedDate: '2026-05-20',
      paymentTerms: 'net30',
      currency: 'USD',
      notes: '',
      lines: [
        {
          productId: null,
          reference: 'SKU-1',
          description: 'Mouse',
          unit: 'piece',
          quantity: 10,
          unitCost: 15,
          discountPct: 0,
          vatRate: 19,
        },
      ],
    });
    request.flush({});

    await expect(created).resolves.toEqual({});
  });

  it('updates a draft when the form carries an id', async () => {
    service.saveDraft({
      id: 'order-1',
      supplierId: 'supplier-1',
      orderDate: '2026-05-10',
      expectedDate: '2026-05-20',
      paymentTerms: 'net30',
      currency: 'USD',
      notes: '',
      lines: [],
    }).subscribe();

    const request = http.expectOne(`${baseUrl}/order-1`);
    expect(request.request.method).toBe('PUT');
    request.flush({});
  });

  it('confirms, cancels and duplicates an order', async () => {
    service.confirmOrder('order-1').subscribe();
    const confirm = http.expectOne(`${baseUrl}/order-1/confirm`);
    expect(confirm.request.method).toBe('POST');
    confirm.flush({});

    service.cancelOrder('order-1').subscribe();
    const cancel = http.expectOne(`${baseUrl}/order-1/cancel`);
    expect(cancel.request.method).toBe('POST');
    cancel.flush({});

    service.duplicateOrder('order-1').subscribe();
    const duplicate = http.expectOne(`${baseUrl}/order-1/duplicate`);
    expect(duplicate.request.method).toBe('POST');
    duplicate.flush({});
  });

  it('sends a reception to the API', async () => {
    service
      .receiveOrder('order-1', {
        date: '2026-05-18',
        blNumber: 'BL-7781',
        warehouseId: 'warehouse-1',
        items: [{ lineId: 'line-1', quantity: 5 }],
      })
      .subscribe();

    const request = http.expectOne(`${baseUrl}/order-1/receptions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      date: '2026-05-18',
      blNumber: 'BL-7781',
      warehouseId: 'warehouse-1',
      items: [{ lineId: 'line-1', quantity: 5 }],
    });
    request.flush({});
  });

  it('deletes a draft', async () => {
    service.deleteDraft('order-1').subscribe();

    const request = http.expectOne(`${baseUrl}/order-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('turns the machine code of the API into a purchase error', async () => {
    const promise = firstValueFrom(service.confirmOrder('order-1'));

    http
      .expectOne(`${baseUrl}/order-1/confirm`)
      .flush({ code: 'notDraft' }, { status: 409, statusText: 'Conflict' });

    await expect(promise).rejects.toMatchObject({ code: 'notDraft' });
  });
});
