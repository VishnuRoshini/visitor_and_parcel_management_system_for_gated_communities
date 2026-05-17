import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@core/guards';
import { UnauthorizedComponent } from './unauthorized/unauthorized.component';

const routes: Routes = [
  { 
    path: 'login', 
    loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule) 
  },
  { 
    path: 'unauthorized', 
    component: UnauthorizedComponent 
  },
  { 
    path: 'admin', 
    loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'visitor', 
    loadChildren: () => import('./visitor/visitor.module').then(m => m.VisitorModule),
    canActivate: [AuthGuard]
  },
  { 
    path: 'parcel', 
    loadChildren: () => import('./parcel/parcel.module').then(m => m.ParcelModule),
    canActivate: [AuthGuard]
  },
  {
    path: 'query',
    loadChildren: () => import('./query/query.module').then(m => m.QueryModule),
    canActivate: [AuthGuard]
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }