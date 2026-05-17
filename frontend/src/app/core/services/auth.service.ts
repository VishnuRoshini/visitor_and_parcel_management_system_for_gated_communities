import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, of, throwError } from 'rxjs';
import { environment } from '@env/environment';
import { 
  User, 
  ApiResponse, 
  LoginRequest, 
  LoginResponse, 
  CreateUserRequest, 
  UpdateUserRequest, 
  ResetPasswordRequest, 
  SetupPasswordRequest, 
  ChangePasswordRequest, 
  CanChangePasswordResponse,
  TwoFactorSetupResponse,
  TwoFactorVerifyRequest,
  TwoFactorVerifyResponse,
  TwoFactorStatusResponse,
  RefreshTokenResponse,
  PasswordValidationResponse,
  OtpRequest,
  OtpVerifyRequest,
  AuditLog,
  AuditLogFilters,
  SecurityEvent,
  PaginatedResponse
} from '../models';

const TOKEN_STORAGE_KEY = 'vpm_token';
const REFRESH_TOKEN_STORAGE_KEY = 'vpm_refresh_token';
const USER_STORAGE_KEY = 'vpm_user';
const TEMP_TOKEN_STORAGE_KEY = 'vpm_temp_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private tokenSubject = new BehaviorSubject<string | null>(null);
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);
  private requires2FASubject = new BehaviorSubject<boolean>(false);
  private tempTokenSubject = new BehaviorSubject<string | null>(null);
  
  public currentUser$ = this.currentUserSubject.asObservable();
  public requires2FA$ = this.requires2FASubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    const storedUser = localStorage.getItem(USER_STORAGE_KEY);
    
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser) as User;
        this.tokenSubject.next(token);
        this.refreshTokenSubject.next(refreshToken);
        this.currentUserSubject.next(user);
      } catch {
        this.clearStorage();
      }
    }
  }

  private clearStorage(): void {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TEMP_TOKEN_STORAGE_KEY);
  }

  get currentUser(): User | null {
    return this.currentUserSubject.value;
  }

  get token(): string | null {
    return this.tokenSubject.value;
  }

  get refreshToken(): string | null {
    return this.refreshTokenSubject.value;
  }

  get tempToken(): string | null {
    return this.tempTokenSubject.value || localStorage.getItem(TEMP_TOKEN_STORAGE_KEY);
  }

  get isAuthenticated(): boolean {
    return !!this.token && !!this.currentUser;
  }

  get userRole(): string | null {
    return this.currentUser?.role || null;
  }

  // Login with email and password
  login(credentials: LoginRequest): Observable<User | { requires2FA: true; tempToken: string }> {
    return this.http.post<ApiResponse<LoginResponse>>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        map(response => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Login failed');
          }
          return response.data;
        }),
        tap(data => {
          if (data.requires2FA && data.tempToken) {
            // 2FA required - store temp token
            localStorage.setItem(TEMP_TOKEN_STORAGE_KEY, data.tempToken);
            this.tempTokenSubject.next(data.tempToken);
            this.requires2FASubject.next(true);
          } else if (data.token && data.user) {
            // Normal login - store token and user
            localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
            if (data.refreshToken) {
              localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
              this.refreshTokenSubject.next(data.refreshToken);
            }
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
            this.tokenSubject.next(data.token);
            this.currentUserSubject.next(data.user);
            this.requires2FASubject.next(false);
          }
        }),
        map(data => {
          if (data.requires2FA && data.tempToken) {
            return { requires2FA: true as const, tempToken: data.tempToken };
          }
          return data.user;
        })
      );
  }

  // Verify 2FA OTP after login
  verify2FA(otp: string): Observable<User> {
    const tempToken = this.tempToken;
    if (!tempToken) {
      return throwError(() => new Error('No temporary token found'));
    }

    return this.http.post<ApiResponse<TwoFactorVerifyResponse>>(`${environment.apiUrl}/auth/verify-2fa`, {
      tempToken,
      code: otp  // Backend expects 'code' not 'otp'
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || '2FA verification failed');
        }
        return response.data;
      }),
      tap(data => {
        // Store tokens and user
        localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, data.refreshToken);
        localStorage.removeItem(TEMP_TOKEN_STORAGE_KEY);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
        
        this.tokenSubject.next(data.token);
        this.refreshTokenSubject.next(data.refreshToken);
        this.currentUserSubject.next(data.user);
        this.tempTokenSubject.next(null);
        this.requires2FASubject.next(false);
      }),
      map(data => data.user)
    );
  }

  // Refresh access token using refresh token
  refreshAccessToken(): Observable<boolean> {
    const refreshToken = this.refreshToken;
    if (!refreshToken) {
      return of(false);
    }

    return this.http.post<ApiResponse<RefreshTokenResponse>>(`${environment.apiUrl}/auth/refresh`, {
      refreshToken
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          this.logout();
          return false;
        }
        
        // Update tokens
        localStorage.setItem(TOKEN_STORAGE_KEY, response.data.token);
        localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, response.data.refreshToken);
        this.tokenSubject.next(response.data.token);
        this.refreshTokenSubject.next(response.data.refreshToken);
        
        return true;
      })
    );
  }

  logout(): void {
    // Call backend to revoke refresh token
    const refreshToken = this.refreshToken;
    if (refreshToken) {
      this.http.post(`${environment.apiUrl}/auth/logout`, { refreshToken }, {
        headers: this.getAuthHeaders()
      }).subscribe();
    }

    this.clearStorage();
    this.tokenSubject.next(null);
    this.refreshTokenSubject.next(null);
    this.currentUserSubject.next(null);
    this.tempTokenSubject.next(null);
    this.requires2FASubject.next(false);
  }

  // Logout from all sessions
  logoutAll(): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/logout-all`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        this.clearStorage();
        this.tokenSubject.next(null);
        this.refreshTokenSubject.next(null);
        this.currentUserSubject.next(null);
      }),
      map(() => void 0)
    );
  }

  cancel2FA(): void {
    localStorage.removeItem(TEMP_TOKEN_STORAGE_KEY);
    this.tempTokenSubject.next(null);
    this.requires2FASubject.next(false);
  }

  // Get authorization headers for API calls
  getAuthHeaders(): { [key: string]: string } {
    const token = this.token;
    if (token) {
      return {
        'Authorization': `Bearer ${token}`
      };
    }
    return {};
  }

  hasRole(...roles: string[]): boolean {
    return this.currentUser ? roles.includes(this.currentUser.role) : false;
  }

  // ==========================================
  // API calls for authenticated users
  // ==========================================

  getResidents(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${environment.apiUrl}/auth/residents`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || [])
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<ApiResponse<User>>(`${environment.apiUrl}/auth/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error('Failed to get user');
        }
        return response.data;
      })
    );
  }

  // ==========================================
  // Admin only - User Management
  // ==========================================

  getAllUsers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${environment.apiUrl}/auth/users`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || [])
    );
  }

  createUser(userData: CreateUserRequest): Observable<User> {
    return this.http.post<ApiResponse<User>>(`${environment.apiUrl}/auth/users`, userData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to create user');
        }
        return response.data;
      })
    );
  }

  updateUser(userId: number, userData: UpdateUserRequest): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${environment.apiUrl}/auth/users/${userId}`, userData, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to update user');
        }
        return response.data;
      })
    );
  }

  resetPassword(userId: number, newPassword: string): Observable<void> {
    const body: ResetPasswordRequest = { newPassword };
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/users/${userId}/reset-password`, body, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to reset password');
        }
      })
    );
  }

  deactivateUser(userId: number): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/users/${userId}/deactivate`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to deactivate user');
        }
      })
    );
  }

  activateUser(userId: number): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/users/${userId}/activate`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to activate user');
        }
      })
    );
  }

  // ==========================================
  // Password Management
  // ==========================================

  // First-time password setup with PIN
  setupPassword(data: SetupPasswordRequest): Observable<void> {
    return this.http.post<ApiResponse<{ user: User }>>(`${environment.apiUrl}/auth/setup-password`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to setup password');
        }
        // Use the updated user from backend response if available
        if (response.data?.user) {
          const updatedUser = response.data.user;
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
          console.log('User updated from backend after password setup:', updatedUser);
        } else if (this.currentUser) {
          // Fallback: Update user in storage to reflect password has been set
          const updatedUser = { 
            ...this.currentUser, 
            mustChangePassword: false,
            must_change_password: false,
            passwordChangedCount: (this.currentUser.passwordChangedCount || 0) + 1,
            password_changed_count: (this.currentUser.password_changed_count || 0) + 1
          };
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      })
    );
  }

  // Change own password (with restrictions for non-admins)
  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/change-password`, data, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to change password');
        }
      })
    );
  }

  // Check if user can change password
  canChangePassword(): Observable<CanChangePasswordResponse> {
    return this.http.get<ApiResponse<CanChangePasswordResponse>>(`${environment.apiUrl}/auth/can-change-password`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to check password change eligibility');
        }
        return response.data;
      })
    );
  }

  // Admin: Reset user password with PIN verification
  adminResetPassword(userId: number, securityPin: string, newPassword: string): Observable<void> {
    const body: ResetPasswordRequest = { securityPin, newPassword };
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/users/${userId}/admin-reset-password`, body, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to reset password');
        }
      })
    );
  }

  // Admin: Check if user has PIN set up
  userHasPin(userId: number): Observable<{ hasPin: boolean }> {
    return this.http.get<ApiResponse<{ hasPin: boolean }>>(`${environment.apiUrl}/auth/users/${userId}/has-pin`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to check user PIN status');
        }
        return response.data;
      })
    );
  }

  // ==========================================
  // Two-Factor Authentication
  // ==========================================

  // Setup 2FA - get QR code and secret
  setup2FA(): Observable<TwoFactorSetupResponse> {
    return this.http.post<ApiResponse<TwoFactorSetupResponse>>(`${environment.apiUrl}/auth/2fa/setup`, {}, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to setup 2FA');
        }
        return response.data;
      })
    );
  }

  // Enable 2FA after verifying the code
  enable2FA(code: string): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/2fa/enable`, { code }, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        // Update local user state
        if (this.currentUser) {
          const updatedUser = { ...this.currentUser, two_factor_enabled: true };
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      }),
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to enable 2FA');
        }
      })
    );
  }

  // Disable 2FA
  disable2FA(code: string): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/2fa/disable`, { code }, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap(() => {
        // Update local user state
        if (this.currentUser) {
          const updatedUser = { ...this.currentUser, two_factor_enabled: false };
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      }),
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to disable 2FA');
        }
      })
    );
  }

  // Get 2FA status
  get2FAStatus(): Observable<TwoFactorStatusResponse> {
    return this.http.get<ApiResponse<TwoFactorStatusResponse>>(`${environment.apiUrl}/auth/2fa/status`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to get 2FA status');
        }
        return response.data;
      })
    );
  }

  // ==========================================
  // Password Validation
  // ==========================================

  // Validate password strength
  validatePassword(password: string): Observable<PasswordValidationResponse> {
    return this.http.post<ApiResponse<PasswordValidationResponse>>(`${environment.apiUrl}/auth/validate-password`, { password }, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to validate password');
        }
        return response.data;
      })
    );
  }

  // ==========================================
  // OTP Operations
  // ==========================================

  // Send OTP to email
  sendOtp(email: string, purpose: 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION'): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/otp/send`, { email, purpose }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to send OTP');
        }
      })
    );
  }

  // Verify OTP
  verifyOtp(email: string, otp: string, purpose: 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION'): Observable<void> {
    return this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/otp/verify`, { email, otp, purpose }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to verify OTP');
        }
      })
    );
  }

  // ==========================================
  // Audit Logs (Admin only)
  // ==========================================

  // Get audit logs with filters
  getAuditLogs(filters: AuditLogFilters = {}): Observable<PaginatedResponse<AuditLog>> {
    const params = new URLSearchParams();
    if (filters.userId) params.append('userId', filters.userId.toString());
    if (filters.action) params.append('action', filters.action);
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return this.http.get<ApiResponse<PaginatedResponse<AuditLog>>>(`${environment.apiUrl}/auth/audit-logs?${params.toString()}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to get audit logs');
        }
        return response.data;
      })
    );
  }

  // Get recent security events
  getSecurityEvents(limit: number = 20): Observable<SecurityEvent[]> {
    return this.http.get<ApiResponse<SecurityEvent[]>>(`${environment.apiUrl}/auth/security-events?limit=${limit}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to get security events');
        }
        return response.data;
      })
    );
  }
}
