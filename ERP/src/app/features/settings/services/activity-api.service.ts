import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ActivityEntry } from '../models/activity';

@Injectable({ providedIn: 'root' })
export class ActivityApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/settings/activity`;

  recent(limit = 8): Observable<ActivityEntry[]> {
    return this.http.get<ActivityEntry[]>(this.baseUrl, { params: { limit } });
  }
}
