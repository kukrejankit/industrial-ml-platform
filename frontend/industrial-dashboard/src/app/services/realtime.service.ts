import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private hub!: signalR.HubConnection;
  newReadings$  = new Subject<any[]>();
  assetUpdated$ = new Subject<any>();

  connect() {
    this.hub = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl)
      .withAutomaticReconnect().build();
    this.hub.on('NewReadings',  d => this.newReadings$.next(d));
    this.hub.on('AssetUpdated', u => this.assetUpdated$.next(u));
    this.hub.start().catch(console.error);
  }
  joinAsset(id: number) {
    this.hub.invoke('JoinAsset', id.toString());
  }
}