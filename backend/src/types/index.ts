// =====================================================
// Type Definitions for Visitor & Parcel Management System
// =====================================================

// User Roles
export type UserRole = 'RESIDENT' | 'SECURITY' | 'ADMIN';

// Record Types
export type RecordType = 'VISITOR' | 'PARCEL';

// Visitor Status Flow: NEW → WAITING → APPROVED/REJECTED → ENTERED → EXITED
export type VisitorStatus = 'NEW' | 'WAITING' | 'APPROVED' | 'REJECTED' | 'ENTERED' | 'EXITED';

// Parcel Status Flow: RECEIVED → ACKNOWLEDGED → COLLECTED
export type ParcelStatus = 'RECEIVED' | 'ACKNOWLEDGED' | 'COLLECTED';

export type RecordStatus = VisitorStatus | ParcelStatus;

// =====================================================
// Database Models
// =====================================================

export interface User {
  id: number;
  name: string;
  email: string;
  password?: string; // Optional - not returned in responses
  security_pin?: string; // 6-digit PIN for password reset verification
  password_changed_count: number; // Track how many times password was changed
  must_change_password: boolean; // Force password change on first login
  role: UserRole;
  contact_info: string | null;
  is_active: boolean;
  two_factor_enabled?: boolean; // 2FA enabled flag
  two_factor_secret?: string; // TOTP secret
  email_verified?: boolean;
  last_login?: Date | null;
  failed_login_attempts?: number;
  locked_until?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Record {
  id: number;
  resident_id: number;
  security_guard_id: number;
  type: RecordType;
  name: string;
  purpose_or_description: string;
  media_url: string | null;
  vehicle_details: string | null;
  status: RecordStatus;
  created_at: Date;
}


// =====================================================
// API Request/Response Types
// =====================================================

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: Omit<User, 'password'>;
}

// JWT Payload
export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// User DTOs
export interface UserDTO {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  contact_info: string | null;
  is_active: boolean;
  must_change_password: boolean;
  password_changed_count: number;
  can_change_password: boolean; // Computed: true if admin OR (resident/security with count < 1)
  created_at: Date;
}

// Create User (Admin only)
export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  contact_info?: string;
}

// Update User
export interface UpdateUserRequest {
  name?: string;
  email?: string;
  contact_info?: string;
  is_active?: boolean;
}

// Reset Password (Admin only - requires PIN verification)
export interface ResetPasswordRequest {
  newPassword: string;
  securityPin: string; // Required for admin to verify user's PIN
}

// First-time password setup (self)
export interface SetupPasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  securityPin: string; // 6-digit PIN for future verification
}

// Self password change (one-time for residents/security)
export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// Check if user can change password response
export interface CanChangePasswordResponse {
  canChange: boolean;
  reason?: string;
  mustSetupFirst?: boolean;
}

// Visitor DTOs
export interface CreateVisitorRequest {
  resident_id: number;
  name: string;
  purpose_or_description?: string;
  media_url?: string;
  vehicle_details?: string;
}

export interface UpdateVisitorStatusRequest {
  status: VisitorStatus;
}

// Parcel DTOs
export interface CreateParcelRequest {
  resident_id: number;
  name: string;
  purpose_or_description?: string;
  media_url?: string;
}

export interface UpdateParcelStatusRequest {
  status: ParcelStatus;
}

// Record with joined user data
export interface RecordWithDetails extends Record {
  resident_name: string;
  guard_name: string;
}

// Dashboard Stats
export interface DashboardStats {
  total_visitors_today: number;
  total_parcels_today: number;
  pending_approvals: number;
  pending_parcels: number;
  visitors_by_status: { status: string; count: number }[];
  parcels_by_status: { status: string; count: number }[];
  recent_activity: RecordWithDetails[];
}

// =====================================================
// Socket Events
// =====================================================

export interface SocketEvents {
  // Server to Client
  'visitor:new': (data: RecordWithDetails) => void;
  'visitor:status-updated': (data: RecordWithDetails) => void;
  'parcel:new': (data: RecordWithDetails) => void;
  'parcel:status-updated': (data: RecordWithDetails) => void;
  
  // Client to Server
  'join:resident-room': (residentId: number) => void;
  'leave:resident-room': (residentId: number) => void;
}

// =====================================================
// API Response Wrapper
// =====================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// =====================================================
// Pagination
// =====================================================

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// =====================================================
// Security & 2FA Types
// =====================================================

// Login with optional 2FA
export interface LoginRequestWith2FA extends LoginRequest {
  twoFactorCode?: string;
}

// Login response with tokens
export interface LoginResponseWithTokens {
  success: boolean;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: Omit<User, 'password' | 'security_pin' | 'two_factor_secret'>;
  mustChangePassword?: boolean;
  requires2FA?: boolean;
  tempToken?: string; // Temporary token for 2FA verification
}

// Refresh token request
export interface RefreshTokenRequest {
  refreshToken: string;
}

// 2FA Setup response
export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  otpAuthUrl: string;
}

// 2FA Verify request
export interface TwoFactorVerifyRequest {
  code: string;
}

// OTP Request
export interface OTPRequest {
  email: string;
  type: 'LOGIN' | 'PASSWORD_RESET';
}

// OTP Verify request
export interface OTPVerifyRequest {
  email: string;
  code: string;
  type: 'LOGIN' | 'PASSWORD_RESET';
}

// Password validation result
export interface PasswordValidationResponse {
  isValid: boolean;
  score: number;
  strengthLabel: string;
  errors: string[];
  suggestions: string[];
}
