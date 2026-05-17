import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../core/services';
import { CanChangePasswordResponse } from '../../core/models';

@Component({
  selector: 'app-change-password-dialog',
  templateUrl: './change-password-dialog.component.html',
  styleUrls: ['./change-password-dialog.component.scss']
})
export class ChangePasswordDialogComponent implements OnInit {
  form: FormGroup;
  loading = false;
  checking = true;
  error = '';
  hideOldPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;
  
  canChange = false;
  changeRestrictionMessage = '';
  isAdmin = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private dialogRef: MatDialogRef<ChangePasswordDialogComponent>
  ) {
    this.form = this.fb.group({
      oldPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.isAdmin = this.authService.currentUser?.role === 'ADMIN';
  }

  ngOnInit(): void {
    this.checkEligibility();
  }

  checkEligibility(): void {
    this.checking = true;
    this.authService.canChangePassword().subscribe({
      next: (result: CanChangePasswordResponse) => {
        this.checking = false;
        this.canChange = result.canChange;
        if (!result.canChange) {
          this.changeRestrictionMessage = result.reason || 'You cannot change your password at this time.';
        }
      },
      error: (err) => {
        this.checking = false;
        this.error = err.error?.message || err.message || 'Failed to check eligibility';
      }
    });
  }

  get passwordsMatch(): boolean {
    const newPassword = this.form.get('newPassword')?.value;
    const confirmPassword = this.form.get('confirmPassword')?.value;
    return newPassword && confirmPassword && newPassword === confirmPassword;
  }

  onSubmit(): void {
    if (!this.canChange) return;
    
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

    this.authService.changePassword(this.form.value).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.message || err.message || 'Failed to change password';
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
