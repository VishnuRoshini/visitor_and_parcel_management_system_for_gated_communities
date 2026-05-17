import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { AuthService, NotificationService } from '@core/services';
import { TwoFactorStatusResponse, TwoFactorSetupResponse } from '@core/models';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

type DialogState = 'loading' | 'status' | 'setup' | 'enable' | 'disable';

@Component({
  selector: 'app-two-factor-settings-dialog',
  templateUrl: './two-factor-settings-dialog.component.html',
  styleUrls: ['./two-factor-settings-dialog.component.scss']
})
export class TwoFactorSettingsDialogComponent implements OnInit, OnDestroy {
  state: DialogState = 'loading';
  isEnabled = false;
  enabledAt: string | null = null;
  
  // Setup state
  setupData: TwoFactorSetupResponse | null = null;
  verifyForm: FormGroup;
  
  // Disable state
  disableForm: FormGroup;
  hidePassword = true;
  
  isProcessing = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TwoFactorSettingsDialogComponent>,
    private authService: AuthService,
    private notification: NotificationService
  ) {
    this.verifyForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern('^[0-9]*$')]]
    });
    
    this.disableForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern('^[0-9]*$')]]
    });
  }

  ngOnInit(): void {
    this.loadStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadStatus(): void {
    this.state = 'loading';
    this.authService.get2FAStatus().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (status) => {
        this.isEnabled = status.enabled;
        this.enabledAt = status.enabledAt || null;
        this.state = 'status';
      },
      error: (error) => {
        this.notification.error(error.message || 'Failed to load 2FA status');
        this.dialogRef.close();
      }
    });
  }

  startSetup(): void {
    this.isProcessing = true;
    this.authService.setup2FA().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.setupData = data;
        this.state = 'setup';
        this.isProcessing = false;
      },
      error: (error) => {
        this.notification.error(error.message || 'Failed to setup 2FA');
        this.isProcessing = false;
      }
    });
  }

  proceedToEnable(): void {
    this.state = 'enable';
    this.verifyForm.reset();
  }

  enable2FA(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.isProcessing = true;
    const otp = this.verifyForm.value.otp;

    this.authService.enable2FA(otp).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.notification.success('Two-Factor Authentication enabled successfully!');
        this.isEnabled = true;
        this.state = 'status';
        this.isProcessing = false;
      },
      error: (error) => {
        this.notification.error(error.error?.message || error.message || 'Invalid verification code');
        this.verifyForm.reset();
        this.isProcessing = false;
      }
    });
  }

  showDisableForm(): void {
    this.state = 'disable';
    this.disableForm.reset();
  }

  disable2FA(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      return;
    }

    this.isProcessing = true;
    const code = this.disableForm.value.code;

    this.authService.disable2FA(code).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.notification.success('Two-Factor Authentication disabled.');
        this.isEnabled = false;
        this.state = 'status';
        this.isProcessing = false;
      },
      error: (error) => {
        this.notification.error(error.error?.message || error.message || 'Failed to disable 2FA');
        this.disableForm.reset();
        this.isProcessing = false;
      }
    });
  }

  goBack(): void {
    this.state = 'status';
  }

  copyToClipboard(text: string | undefined): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.notification.success('Secret key copied to clipboard!');
    }).catch(() => {
      this.notification.error('Failed to copy to clipboard');
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
