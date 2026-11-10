import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-signup-result',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './signup-result.html',
  styleUrl: './signup-result.css',
})
export class SignupResultComponent {
  private readonly route = inject(ActivatedRoute);

  readonly mode = this.route.snapshot.data['mode'] === 'cancelled' ? 'cancelled' : 'success';
  readonly trial = this.route.snapshot.queryParamMap.get('trial') === '1';
  readonly resultKey = this.mode === 'success' && this.trial ? 'trial' : this.mode;
}
