import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http   = inject(HttpClient);
  private router = inject(Router);
  token       = signal<string|null>(null);
  currentUser = signal<any>(null);

  constructor() {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (t && u) { this.token.set(t); this.currentUser.set(JSON.parse(u)); }
  }

  login(email: string, password: string) {
    return this.http.post<any>(
      `${environment.apiUrl}/auth/login`, { email, password });
  }

  setSession(res: any) {
    this.token.set(res.token);
    this.currentUser.set(res.user);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
  }

  logout() {
    this.token.set(null); this.currentUser.set(null);
    localStorage.clear(); this.router.navigate(['/login']);
  }

  isLoggedIn() { return !!this.token(); }
}