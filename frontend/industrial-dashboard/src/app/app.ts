import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.html'
})
export class AppComponent {
  private router = inject(Router);
  title = 'industrial-dashboard';

  navigate(path: string) {
    this.router.navigate([path]);
  }
}