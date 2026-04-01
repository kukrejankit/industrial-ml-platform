import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService, Asset } from '../../services/api.service';
import { RealtimeService } from '../../services/realtime.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private rt  = inject(RealtimeService);

  assets: Asset[] = [];
  private pollInterval: any;

  get critical() {
    return this.assets.filter(a => a.status === 'critical').length;
  }
  get warning() {
    return this.assets.filter(a => a.status === 'warning').length;
  }
  get normal() {
    return this.assets.filter(a => a.status === 'normal').length;
  }

  ngOnInit() {
    this.loadAssets();

    // Poll every 5 seconds
    this.pollInterval = setInterval(() => {
      this.loadAssets();
    }, 5000);

    // Also listen for SignalR updates
    this.rt.connect();
    this.rt.assetUpdated$.subscribe((update: any) => {
      const asset = this.assets.find(a => a.id === update.assetId);
      if (asset) {
        asset.healthScore = update.healthScore;
        asset.status      = update.status;
      }
    });
  }

  loadAssets() {
    this.api.getAssets(1).subscribe(a => this.assets = a);
  }

  ngOnDestroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }

  healthColor(score: number): string {
    if (score >= 80) return '#16a34a';
    if (score >= 60) return '#d97706';
    return '#dc2626';
  }
}
