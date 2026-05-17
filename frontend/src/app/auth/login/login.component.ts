import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService, NotificationService } from '@core/services';
import { User } from '@core/models';
import { PasswordSetupDialogComponent } from '../password-setup-dialog/password-setup-dialog.component';
import { TwoFactorDialogComponent } from '../two-factor-dialog/two-factor-dialog.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  isLoading = false;
  hidePassword = true;
  returnUrl: string = '/';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.authService.isAuthenticated) {
      this.checkPasswordSetup();
      return;
    }

    // Get return URL
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: (result) => {
        // Check if 2FA is required
        if (result && typeof result === 'object' && 'requires2FA' in result && result.requires2FA) {
          this.isLoading = false;
          this.show2FADialog();
        } else {
          // Normal login successful
          const user = result as User;
          this.notification.success(`Welcome, ${user.name}!`);
          this.checkPasswordSetup();
        }
      },
      error: (error) => {
        this.isLoading = false;
        const errorMessage = error.error?.message || 'Login failed. Please enter correct Email/Password.';
        
        // Check for specific error types
        if (errorMessage.includes('locked')) {
          this.notification.error('Account is locked due to too many failed attempts. Please try again later.');
        } else if (errorMessage.includes('rate limit') || error.status === 429) {
          this.notification.error('Too many login attempts. Please wait a few minutes before trying again.');
        } else {
          this.notification.error(errorMessage);
        }
      }
    });
  }

  private show2FADialog(): void {
    const dialogRef = this.dialog.open(TwoFactorDialogComponent, {
      width: '450px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // 2FA verification successful
        this.checkPasswordSetup();
      } else {
        // 2FA cancelled
        this.notification.info('Login cancelled.');
      }
    });
  }

  private checkPasswordSetup(): void {
    const user = this.authService.currentUser;
    if (!user) return;
    // Password setup on first login is now disabled
    this.redirectBasedOnRole();
  }

  private showPasswordSetupDialog(): void {
    const dialogRef = this.dialog.open(PasswordSetupDialogComponent, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.notification.success('Password setup completed successfully!');
        this.redirectBasedOnRole();
      } else {
        // User didn't complete setup - log them out
        this.authService.logout();
        this.notification.warning('Please complete password setup to continue.');
      }
    });
  }

  private redirectBasedOnRole(): void {
    const user = this.authService.currentUser;
    if (!user) return;

    switch (user.role) {
      case 'ADMIN':
        this.router.navigate(['/admin/dashboard']);
        break;
      case 'SECURITY':
        this.router.navigate(['/visitor/log']);
        break;
      case 'RESIDENT':
        this.router.navigate(['/visitor/approval']);
        break;
      default:
        this.router.navigate(['/']);
    }
  }
}
