import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { RoleGuard } from '@core/guards';

import { VisitorLogComponent } from './visitor-log/visitor-log.component';
import { ResidentApprovalComponent } from './resident-approval/resident-approval.component';
import { VisitorFormDialogComponent } from './visitor-form-dialog/visitor-form-dialog.component';

const routes: Routes = [
  { 
    path: 'log', 
    component: VisitorLogComponent,
    canActivate: [RoleGuard],
    data: { roles: ['SECURITY', 'ADMIN'] }
  },
  { 
    path: 'approval', 
    component: ResidentApprovalComponent,
    canActivate: [RoleGuard],
    data: { roles: ['RESIDENT'] }
  },
  { path: '', redirectTo: 'approval', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    VisitorLogComponent,
    ResidentApprovalComponent,
    VisitorFormDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class VisitorModule { }
