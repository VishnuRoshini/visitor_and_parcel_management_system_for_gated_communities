import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../core/services';

@Component({
  selector: 'app-password-setup-dialog',
  templateUrl: './password-setup-dialog.component.html',
  styleUrls: ['./password-setup-dialog.component.scss']
})
export class PasswordSetupDialogComponent {
  form: FormGroup;
  loading = false;
  error = '';
  hideOldPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private dialogRef: MatDialogRef<PasswordSetupDialogComponent>
  ) {
    this.form = this.fb.group({
      oldPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
      securityPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
    });

    // Prevent closing by clicking outside
    this.dialogRef.disableClose = true;
  }

  get passwordsMatch(): boolean {
    const newPassword = this.form.get('newPassword')?.value;
    const confirmPassword = this.form.get('confirmPassword')?.value;
    return newPassword && confirmPassword && newPassword === confirmPassword;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.passwordsMatch) {
      this.error = 'New password and confirm password do not match';
      return;
    }

    if (this.form.get('oldPassword')?.value === this.form.get('newPassword')?.value) {
      this.error = 'New password must be different from old password';
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.setupPassword(this.form.value).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.message || 'Failed to setup password';
      }
    });
  }
}
