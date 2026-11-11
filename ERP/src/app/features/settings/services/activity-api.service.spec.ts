import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ActivityApiService } from './activity-api.service';

describe('ActivityApiService', () => {
  let api: ActivityApiService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/settings/activity`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ActivityApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the recent activity with a limit', () => {
    api.recent(8).subscribe();

    const request = http.expectOne(
      (req) => req.url === baseUrl && req.params.get('limit') === '8',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
