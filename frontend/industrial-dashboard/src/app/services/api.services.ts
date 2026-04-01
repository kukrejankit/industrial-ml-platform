import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Asset {
  id: number; name: string; assetType: string;
  status: 'normal'|'warning'|'critical'|'offline';
  healthScore: number; rulDays: number;
}
export interface SensorReading {
  recordedAt: string; value: number; quality: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  getAssets(siteId: number): Observable<Asset[]> {
    return this.http.get<Asset[]>(`${this.base}/assets`,
      { params: { siteId: siteId.toString() } });
  }
  getAsset(id: number): Observable<Asset> {
    return this.http.get<Asset>(`${this.base}/assets/${id}`);
  }
  getReadings(tagId: number): Observable<SensorReading[]> {
    return this.http.get<SensorReading[]>(
      `${this.base}/readings/${tagId}`,
      { params: new HttpParams().set('limit','300') });
  }
  getPredictions(assetId: number): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.base}/predictions/${assetId}`);
  }
}