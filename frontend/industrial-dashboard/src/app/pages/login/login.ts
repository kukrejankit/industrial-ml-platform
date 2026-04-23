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

  mode: 'login' | 'register' = 'login';

  // Login fields
  email    = '';
  password = '';

  // Register fields
  regFullName    = '';
  regCompanyName = '';
  regEmail       = '';
  regPassword    = '';
  regConfirm     = '';

  error   = '';
  success = '';
  loading = false;

  switchMode(m: 'login' | 'register') {
    this.mode    = m;
    this.error   = '';
    this.success = '';
  }

  login() {
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

  register() {
    if (!this.regFullName.trim() || !this.regCompanyName.trim() ||
        !this.regEmail.trim()    || !this.regPassword) return;

    if (this.regPassword !== this.regConfirm) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (this.regPassword.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }

    this.loading = true;
    this.error   = '';
    this.success = '';

    this.auth.register(
      this.regEmail.trim(),
      this.regPassword,
      this.regFullName.trim(),
      this.regCompanyName.trim()
    ).subscribe({
      next: () => {
        this.loading = false;
        this.success = 'Account created! You can now sign in.';
        this.email    = this.regEmail;
        this.password = '';
        setTimeout(() => this.switchMode('login'), 1800);
      },
      error: (err: any) => {
        this.loading = false;
        this.error   = err?.error ?? 'Registration failed. Please try again.';
      }
    });
  }

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this.mode === 'login' ? this.login() : this.register();
    }
  }
}
