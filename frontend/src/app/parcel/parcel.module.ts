import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { RoleGuard } from '@core/guards';

import { ParcelLogComponent } from './parcel-log/parcel-log.component';
import { ResidentParcelComponent } from './resident-parcel/resident-parcel.component';
import { ParcelFormDialogComponent } from './parcel-form-dialog/parcel-form-dialog.component';

const routes: Routes = [
  { 
    path: 'log', 
    component: ParcelLogComponent,
    canActivate: [RoleGuard],
    data: { roles: ['SECURITY', 'ADMIN'] }
  },
  { 
    path: 'tracking', 
    component: ResidentParcelComponent,
    canActivate: [RoleGuard],
    data: { roles: ['RESIDENT'] }
  },
  { path: '', redirectTo: 'tracking', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    ParcelLogComponent,
    ResidentParcelComponent,
    ParcelFormDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class ParcelModule { }
