import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { SignupStateService } from '../../services/signup-state.service';

@Component({
  selector: 'app-signup',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class SignupComponent implements OnDestroy {
  /** All wizard state lives here, so route changes never lose the selection. */
  readonly state = inject(SignupStateService);
  private readonly route = inject(ActivatedRoute);

  /** Suite shown on the page, or undefined on the /signup hub. */
  get suite() {
    return this.state.resolveSuite(this.route.snapshot.paramMap.get('suite'));
  }

  ngOnDestroy(): void {
    this.state.cleanupTimers();
  }
}
