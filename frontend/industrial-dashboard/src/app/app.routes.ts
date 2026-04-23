import { Routes } from '@angular/router';
import { InterviewToolComponent } from './pages/interview-tool/interview-tool';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { ClientDataCollectorComponent } from './pages/client-data-collector/client-data-collector';
import { ClientFormComponent } from './pages/client-form/client-form';
import { LoginComponent } from './pages/login/login';
import { AssetDetailComponent } from './pages/asset-detail/asset-detail';
import { FvmDataRequestComponent } from './pages/fvm-data-request/fvm-data-request';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '',          component: DashboardComponent,           pathMatch: 'full', canActivate: [authGuard] },
  { path: 'interview', component: InterviewToolComponent,                          canActivate: [authGuard] },
  { path: 'data-collector', component: ClientDataCollectorComponent,               canActivate: [authGuard] },
  { path: 'fvm-data-request', component: FvmDataRequestComponent,                 canActivate: [authGuard] },
  { path: 'assets/:id', component: AssetDetailComponent,                           canActivate: [authGuard] },
  { path: 'form/:id',  component: ClientFormComponent },
  { path: '**', redirectTo: '' }
];
