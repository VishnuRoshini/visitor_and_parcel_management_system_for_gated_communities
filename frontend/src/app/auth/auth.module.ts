import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';

import { LoginComponent } from './login/login.component';
import { PasswordSetupDialogComponent } from './password-setup-dialog/password-setup-dialog.component';
import { ChangePasswordDialogComponent } from './change-password-dialog/change-password-dialog.component';
import { TwoFactorDialogComponent } from './two-factor-dialog/two-factor-dialog.component';
import { TwoFactorSettingsDialogComponent } from './two-factor-settings-dialog/two-factor-settings-dialog.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  declarations: [
    LoginComponent,
    PasswordSetupDialogComponent,
    ChangePasswordDialogComponent,
    TwoFactorDialogComponent,
    TwoFactorSettingsDialogComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ],
  exports: [
    PasswordSetupDialogComponent,
    ChangePasswordDialogComponent,
    TwoFactorDialogComponent,
    TwoFactorSettingsDialogComponent
  ]
})
export class AuthModule { }
