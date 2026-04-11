import { Routes } from '@angular/router';
import { InterviewToolComponent } from './pages/interview-tool/interview-tool';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { ClientDataCollectorComponent } from './pages/client-data-collector/client-data-collector';
import { ClientFormComponent } from './pages/client-form/client-form';

export const routes: Routes = [
  { path: '', component: DashboardComponent, pathMatch: 'full' },
  { path: 'interview', component: InterviewToolComponent },
  { path: 'data-collector', component: ClientDataCollectorComponent },
  { path: 'form/:id', component: ClientFormComponent },
  { path: '**', component: DashboardComponent }
];
