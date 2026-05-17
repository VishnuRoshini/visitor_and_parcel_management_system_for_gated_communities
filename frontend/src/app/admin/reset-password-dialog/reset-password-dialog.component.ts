import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AuthService, NotificationService } from '@core/services';
import { User } from '@core/models';

interface DialogData {
  user: User;
}

@Component({
  selector: 'app-reset-password-dialog',
  templateUrl: './reset-password-dialog.component.html',
  styleUrls: ['./reset-password-dialog.component.scss']
})
export class ResetPasswordDialogComponent implements OnInit {
  form: FormGroup;
  isLoading = false;
  checkingPin = true;
  hidePassword = true;
  hideConfirmPassword = true;
  
  hasPin = false;
  noPinMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private notification: NotificationService,
    private dialogRef: MatDialogRef<ResetPasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.form = this.fb.group({
      securityPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.checkUserHasPin();
  }

  checkUserHasPin(): void {
    this.checkingPin = true;
    this.authService.userHasPin(this.data.user.id).subscribe({
      next: (result) => {
        this.checkingPin = false;
        this.hasPin = result.hasPin;
        if (!result.hasPin) {
          this.noPinMessage = `${this.data.user.name} has not set up their security PIN yet. They need to complete their first-time password setup before you can reset their password.`;
        }
      },
      error: (error) => {
        this.checkingPin = false;
        this.notification.error(error.error?.message || 'Failed to check user PIN status');
      }
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('newPassword')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    
    if (password !== confirmPassword) {
      form.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (!this.hasPin) return;
    
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { securityPin, newPassword } = this.form.value;

    this.authService.adminResetPassword(this.data.user.id, securityPin, newPassword).subscribe({
      next: () => {
        this.notification.success(`Password reset for ${this.data.user.name}`);
        this.dialogRef.close(true);
      },
      error: (error) => {
        this.notification.error(error.error?.message || 'Failed to reset password');
        this.isLoading = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
