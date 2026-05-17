import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/services';

@Component({
  selector: 'app-unauthorized',
  template: `
    <div class="unauthorized-container">
      <mat-card class="unauthorized-card">
        <mat-icon class="error-icon">block</mat-icon>
        <h1>Access Denied</h1>
        <p>You don't have permission to access this page.</p>
        <p class="hint">
          Current role: <strong>{{ currentRole }}</strong>
        </p>
        <button mat-raised-button color="primary" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          Go Back
        </button>
      </mat-card>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--background-color);
    }

    .unauthorized-card {
      text-align: center;
      padding: 48px;
      max-width: 400px;

      .error-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        color: var(--error-color);
        margin-bottom: 16px;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 24px;
        color: var(--text-primary);
      }

      p {
        margin: 0 0 16px;
        color: var(--text-secondary);
      }

      .hint {
        margin-bottom: 24px;
        padding: 12px;
        background: #F8FAFC;
        border-radius: 8px;

        strong {
          color: var(--accent-color);
        }
      }
    }
  `]
})
export class UnauthorizedComponent {
  currentRole: string;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {
    this.currentRole = this.authService.currentUser?.role || 'Unknown';
  }

  goBack(): void {
    const user = this.authService.currentUser;
    if (user) {
      switch (user.role) {
        case 'ADMIN':
          this.router.navigate(['/admin/dashboard']);
          break;
        case 'SECURITY':
          this.router.navigate(['/visitor/log']);
          break;
        case 'RESIDENT':
          this.router.navigate(['/visitor/approvals']);
          break;
        default:
          this.router.navigate(['/login']);
      }
    } else {
      this.router.navigate(['/login']);
    }
  }
}
