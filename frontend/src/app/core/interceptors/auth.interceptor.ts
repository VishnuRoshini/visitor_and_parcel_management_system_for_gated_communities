import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router,
    private notification: NotificationService
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Add token to request if available
    const token = this.authService.token;
    
    if (token) {
      request = this.addToken(request, token);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          // Skip token refresh for auth endpoints (login, register, etc.)
          if (request.url.includes('/auth/login') || request.url.includes('/auth/register')) {
            return throwError(() => error);
          }
          
          // Check if this is the refresh endpoint itself
          if (request.url.includes('/auth/refresh')) {
            this.authService.logout();
            this.notification.error('Session expired. Please login again.');
            this.router.navigate(['/auth/login']);
            return throwError(() => error);
          }
          
          // Try to refresh the token
          return this.handle401Error(request, next);
        } else if (error.status === 403) {
          // Forbidden - user doesn't have permission
          this.notification.error('You do not have permission to perform this action.');
          this.router.navigate(['/unauthorized']);
        } else if (error.status === 429) {
          // Rate limited
          const retryAfter = error.headers.get('Retry-After');
          const message = retryAfter 
            ? `Too many requests. Please wait ${retryAfter} seconds.`
            : 'Too many requests. Please try again later.';
          this.notification.error(message);
        }
        
        return throwError(() => error);
      })
    );
  }

  private addToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshAccessToken().pipe(
        switchMap((success: boolean) => {
          this.isRefreshing = false;
          
          if (success) {
            const newToken = this.authService.token;
            this.refreshTokenSubject.next(newToken);
            return next.handle(this.addToken(request, newToken!));
          } else {
            this.authService.logout();
            this.notification.error('Session expired. Please login again.');
            this.router.navigate(['/auth/login']);
            return throwError(() => new Error('Token refresh failed'));
          }
        }),
        catchError((err) => {
          this.isRefreshing = false;
          this.authService.logout();
          this.notification.error('Session expired. Please login again.');
          this.router.navigate(['/auth/login']);
          return throwError(() => err);
        })
      );
    } else {
      // Wait for token refresh to complete
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => {
          return next.handle(this.addToken(request, token!));
        })
      );
    }
  }
}
