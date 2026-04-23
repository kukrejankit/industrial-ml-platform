import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  email    = '';
  password = '';
  error    = '';
  loading  = false;

  submit() {
    if (!this.email.trim() || !this.password) return;
    this.loading = true;
    this.error   = '';

    this.auth.login(this.email.trim(), this.password).subscribe({
      next: res => {
        this.auth.setSession(res);
        this.router.navigate(['/']);
      },
      error: () => {
        this.error   = 'Invalid email or password. Please try again.';
        this.loading = false;
      }
    });
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') this.submit();
  }
}
