import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { RoleGuard } from '@core/guards';

import { MyQueriesComponent }             from './my-queries/my-queries.component';
import { QueryFormComponent }             from './query-form/query-form.component';
import { QueryHistoryComponent }          from './query-history/query-history.component';
import { AdminQueryManagementComponent }  from './admin-query-management/admin-query-management.component';
import { QueryDetailsDialogComponent }    from './query-details-dialog/query-details-dialog.component';

const routes: Routes = [
  {
    path: 'my-queries',
    component: MyQueriesComponent,
    canActivate: [RoleGuard],
    data: { roles: ['RESIDENT'] },
  },
  {
    path: 'admin-queries',
    component: AdminQueryManagementComponent,
    canActivate: [RoleGuard],
    data: { roles: ['ADMIN'] },
  },
  { path: '', redirectTo: 'my-queries', pathMatch: 'full' },
];

@NgModule({
  declarations: [
    MyQueriesComponent,
    QueryFormComponent,
    QueryHistoryComponent,
    AdminQueryManagementComponent,
    QueryDetailsDialogComponent,
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes),
  ],
})
export class QueryModule {}
