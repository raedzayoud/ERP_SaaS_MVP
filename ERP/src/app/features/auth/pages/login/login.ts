import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { DEMO_USERS, DemoUser } from '../../../../core/data/demo-users';
import { roleLabelKey } from '../../../../core/models/role';

@Component({
  selector: 'app-login',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  readonly demoUsers = DEMO_USERS;

  constructor(private router: Router) {}

  openLogin(user: DemoUser): void {
    this.router.navigate(['/login', user.role]);
  }

  roleKey(user: DemoUser): string {
    return roleLabelKey(user.role);
  }
}
