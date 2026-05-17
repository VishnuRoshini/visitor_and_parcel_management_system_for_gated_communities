import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { AuthService, NotificationService } from '@core/services';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-two-factor-dialog',
  templateUrl: './two-factor-dialog.component.html',
  styleUrls: ['./two-factor-dialog.component.scss']
})
export class TwoFactorDialogComponent implements OnInit, OnDestroy {
  otpForm: FormGroup;
  isLoading = false;
  remainingTime = 300; // 5 minutes
  timerInterval: any;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<TwoFactorDialogComponent>,
    private authService: AuthService,
    private notification: NotificationService
  ) {
    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern('^[0-9]*$')]]
    });
  }

  ngOnInit(): void {
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  startTimer(): void {
    this.timerInterval = setInterval(() => {
      this.remainingTime--;
      if (this.remainingTime <= 0) {
        clearInterval(this.timerInterval);
        this.notification.warning('Verification code expired. Please try logging in again.');
        this.dialogRef.close(false);
      }
    }, 1000);
  }

  get formattedTime(): string {
    const minutes = Math.floor(this.remainingTime / 60);
    const seconds = this.remainingTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  onSubmit(): void {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const otp = this.otpForm.value.otp;

    this.authService.verify2FA(otp).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (user) => {
        this.isLoading = false;
        this.notification.success(`Welcome, ${user.name}!`);
        this.dialogRef.close(user);
      },
      error: (error) => {
        this.isLoading = false;
        this.notification.error(error.error?.message || error.message || 'Invalid verification code');
        this.otpForm.reset();
      }
    });
  }

  onCancel(): void {
    this.authService.cancel2FA();
    this.dialogRef.close(false);
  }
}
