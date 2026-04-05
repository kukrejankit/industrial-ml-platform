import { Routes } from '@angular/router';
import { InterviewToolComponent } from './pages/interview-tool/interview-tool';
import { DashboardComponent } from './pages/dashboard/dashboard';

export const routes: Routes = [
  { path: '', component: DashboardComponent, pathMatch: 'full' },
  { path: 'interview', component: InterviewToolComponent },
  { path: '**', component: DashboardComponent }
];