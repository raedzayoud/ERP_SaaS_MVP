import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ProductService } from './product.service';

const NEW_PRODUCT = {
  type: 'good' as const,
  sku: 'SKU-1001',
  name: 'Laptop Pro 14',
  description: '14 inch business laptop',
  category: 'hardware',
  unit: 'piece',
  salePrice: 1299,
  purchasePrice: 900,
  vatRate: 19,
  minStock: 6,
  suppliers: [],
};

describe('ProductService', () => {
  let service: ProductService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/products`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks the API for one filtered page of products', async () => {
    const page = firstValueFrom(
      service.getProducts({
        page: 0,
        size: 10,
        search: 'laptop',
        type: 'good',
        category: 'hardware',
        active: true,
        sort: 'name,asc',
      }),
    );

    const request = http.expectOne(
      (req) =>
        req.url === baseUrl &&
        req.params.get('page') === '0' &&
        req.params.get('size') === '10' &&
        req.params.get('search') === 'laptop' &&
        req.params.get('type') === 'good' &&
        req.params.get('category') === 'hardware' &&
        req.params.get('active') === 'true' &&
        req.params.get('sort') === 'name,asc',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0, page: 0, size: 10 });

    expect((await page).total).toBe(0);
  });

  it('returns undefined for an unknown id', async () => {
    const product = firstValueFrom(service.getProduct('does-not-exist'));

    http
      .expectOne(`${baseUrl}/does-not-exist`)
      .flush({ message: 'product not found' }, { status: 404, statusText: 'Not Found' });

    expect(await product).toBeUndefined();
  });

  it('creates a product', async () => {
    const created = firstValueFrom(service.createProduct(NEW_PRODUCT));

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.sku).toBe('SKU-1001');
    request.flush({ id: 'p1', ...NEW_PRODUCT, active: true });

    expect((await created).id).toBe('p1');
  });

  it('archives and restores a product', async () => {
    const archived = firstValueFrom(service.archiveProduct('p1'));

    const request = http.expectOne(`${baseUrl}/p1/archive`);
    expect(request.request.method).toBe('PATCH');
    request.flush({ id: 'p1', active: false });

    expect((await archived).active).toBe(false);

    const restored = firstValueFrom(service.restoreProduct('p1'));
    http.expectOne(`${baseUrl}/p1/restore`).flush({ id: 'p1', active: true });

    expect((await restored).active).toBe(true);
  });

  it('keeps the error code returned by the API', async () => {
    const failure = firstValueFrom(service.createProduct(NEW_PRODUCT));

    http
      .expectOne(baseUrl)
      .flush(
        { message: 'a product with this SKU already exists', code: 'duplicateSku' },
        { status: 409, statusText: 'Conflict' },
      );

    const error = await failure.catch((reason: unknown) => reason);
    expect((error as { code?: string }).code).toBe('duplicateSku');
  });
});
