import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.html'
})
export class AppComponent {
  private router = inject(Router);
  auth = inject(AuthService);

  get showNav(): boolean {
    return this.auth.isLoggedIn() && !this.router.url.startsWith('/login') && !this.router.url.startsWith('/form');
  }

  navigate(path: string) {
    this.router.navigate([path]);
  }

  logout() {
    this.auth.logout();
  }
}
