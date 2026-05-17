// =====================================================
// Type Definitions for Frontend
// =====================================================

export type UserRole = 'RESIDENT' | 'SECURITY' | 'ADMIN';
export type RecordType = 'VISITOR' | 'PARCEL';
export type VisitorStatus = 'NEW' | 'WAITING' | 'APPROVED' | 'REJECTED' | 'ENTERED' | 'EXITED';
export type ParcelStatus = 'RECEIVED' | 'ACKNOWLEDGED' | 'COLLECTED';
export type RecordStatus = VisitorStatus | ParcelStatus;

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  contact_info: string | null;
  is_active: boolean;
  mustChangePassword?: boolean;
  must_change_password?: boolean; // Backend uses snake_case
  passwordChangedCount?: number;
  password_changed_count?: number; // Backend uses snake_case
  two_factor_enabled?: boolean;
  email_verified?: boolean;
  last_login?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
  requires2FA?: boolean;
  tempToken?: string;
}

// Two-Factor Authentication Types
export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
}

export interface TwoFactorVerifyRequest {
  tempToken: string;
  otp: string;
}

export interface TwoFactorVerifyResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  enabledAt?: string;
}

// Refresh Token Types
export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
}

// Password Validation Types
export interface PasswordValidationRequest {
  password: string;
}

export interface PasswordValidationResponse {
  isValid: boolean;
  score: number;
  label: string;
  errors: string[];
  suggestions: string[];
}

// OTP Types
export interface OtpRequest {
  email: string;
  purpose: 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';
}

export interface OtpVerifyRequest {
  email: string;
  otp: string;
  purpose: 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';
}

// Audit Log Types
export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  ip_address: string;
  user_agent: string;
  details: string;
  status: 'SUCCESS' | 'FAILURE';
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface AuditLogFilters {
  userId?: number;
  action?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface SecurityEvent {
  id: number;
  action: string;
  ip_address: string;
  user_name: string;
  user_email: string;
  details: string;
  created_at: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  contact_info?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  contact_info?: string;
  is_active?: boolean;
}

export interface ResetPasswordRequest {
  newPassword: string;
  securityPin?: string;
}

export interface SetupPasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
  securityPin: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CanChangePasswordResponse {
  canChange: boolean;
  reason?: string;
  remainingChanges?: number;
  mustSetupFirst?: boolean;
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
  // Joined fields
  resident_name?: string;
  guard_name?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
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

export interface DashboardStats {
  totalVisitorsToday: number;
  totalParcelsToday: number;
  pendingApprovals: number;
  pendingParcels: number;
  visitorsByStatus: { status: string; count: number }[];
  parcelsByStatus: { status: string; count: number }[];
  recentActivity: Record[];
}

export interface CreateVisitorRequest {
  resident_id: number;
  name: string;
  purpose_or_description: string;
  media_url?: string;
  vehicle_details?: string;
}

export interface CreateParcelRequest {
  resident_id: number;
  name: string;
  purpose_or_description: string;
  media_url?: string;
}

// Status flow configurations
export const VISITOR_STATUS_FLOW: { [key in VisitorStatus]: VisitorStatus[] } = {
  NEW: ['WAITING'],
  WAITING: ['APPROVED', 'REJECTED'],
  APPROVED: ['ENTERED'],
  REJECTED: [],
  ENTERED: ['EXITED'],
  EXITED: [],
};

export const PARCEL_STATUS_FLOW: { [key in ParcelStatus]: ParcelStatus[] } = {
  RECEIVED: ['ACKNOWLEDGED'],
  ACKNOWLEDGED: ['COLLECTED'],
  COLLECTED: [],
};
