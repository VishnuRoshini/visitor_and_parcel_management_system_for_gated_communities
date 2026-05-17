import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { RoleGuard } from '@core/guards';

import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard.component';
import { UserManagementComponent } from './user-management/user-management.component';
import { UserFormDialogComponent } from './user-form-dialog/user-form-dialog.component';
import { ResetPasswordDialogComponent } from './reset-password-dialog/reset-password-dialog.component';

const routes: Routes = [
  { 
    path: 'dashboard', 
    component: AdminDashboardComponent,
    canActivate: [RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  { 
    path: 'users', 
    component: UserManagementComponent,
    canActivate: [RoleGuard],
    data: { roles: ['ADMIN'] }
  },
  { 
    path: 'residents', 
    component: UserManagementComponent,
    canActivate: [RoleGuard],
    data: { roles: ['ADMIN'], filterRole: 'RESIDENT' }
  },
  { 
    path: 'guards', 
    component: UserManagementComponent,
    canActivate: [RoleGuard],
    data: { roles: ['ADMIN'], filterRole: 'SECURITY' }
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    AdminDashboardComponent,
    UserManagementComponent,
    UserFormDialogComponent,
    ResetPasswordDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class AdminModule { }
