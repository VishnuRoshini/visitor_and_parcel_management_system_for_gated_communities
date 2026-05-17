import jwt from 'jsonwebtoken';
import { UserModel } from '../models';
import { User, LoginRequest, LoginResponse, JwtPayload, CreateUserRequest, UpdateUserRequest, SetupPasswordRequest, ChangePasswordRequest, CanChangePasswordResponse, LoginResponseWithTokens } from '../types';
import { UnauthorizedError, NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';
import { validatePassword, getPasswordStrengthLabel } from '../utils/passwordValidator';
import { config } from '../config';
import { TokenService } from './TokenService';
import { AuditLogService, getRequestInfo } from './AuditLogService';
import { TOTPService, OTPService } from './TwoFactorService';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// Token expiry: 7 days (good balance between security and convenience)
const TOKEN_EXPIRY = '7d';

// Account lockout settings (DISABLED FOR TESTING)
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const ACCOUNT_LOCKOUT_ENABLED = false; // Set to true in production

export class AuthService {
  // Generate JWT token (legacy - for backwards compatibility)
  private static generateToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    
    return jwt.sign(payload, config.sessionSecret, { expiresIn: TOKEN_EXPIRY });
  }

  // Verify JWT token
  static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.sessionSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token expired. Please login again.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token. Please login again.');
      }
      throw new UnauthorizedError('Authentication failed.');
    }
  }

  // Check if account is locked (disabled for testing)
  private static async isAccountLocked(userId: number): Promise<boolean> {
    if (!ACCOUNT_LOCKOUT_ENABLED) return false; // Disabled for testing
    
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT locked_until FROM users WHERE id = ?',
      [userId]
    );
    
    if (rows.length === 0) return false;
    
    const lockedUntil = rows[0].locked_until;
    if (!lockedUntil) return false;
    
    return new Date(lockedUntil) > new Date();
  }

  // Increment failed login attempts (disabled for testing)
  private static async incrementFailedAttempts(userId: number): Promise<void> {
    if (!ACCOUNT_LOCKOUT_ENABLED) return; // Disabled for testing
    
    const [result] = await pool.execute<ResultSetHeader>(
      `UPDATE users SET failed_login_attempts = failed_login_attempts + 1,
       locked_until = CASE 
         WHEN failed_login_attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
         ELSE locked_until 
       END
       WHERE id = ?`,
      [MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MINUTES, userId]
    );
  }

  // Reset failed login attempts
  private static async resetFailedAttempts(userId: number): Promise<void> {
    await pool.execute(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?',
      [userId]
    );
  }

  // Enhanced login with 2FA support and audit logging
  static async loginEnhanced(
    credentials: LoginRequest & { twoFactorCode?: string },
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<LoginResponseWithTokens> {
    const { email, password, twoFactorCode } = credentials;
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      await AuditLogService.logFailure('LOGIN_FAILED', 'AUTH', null, 'Invalid email', null, { email }, ipAddress, userAgent);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if account is locked
    if (await this.isAccountLocked(user.id)) {
      await AuditLogService.logFailure('LOGIN_FAILED', 'AUTH', user.id, 'Account locked', null, { email }, ipAddress, userAgent);
      throw new ForbiddenError(`Account is temporarily locked. Please try again in ${LOCKOUT_DURATION_MINUTES} minutes.`);
    }

    // Check if user is active
    if (!user.is_active) {
      await AuditLogService.logFailure('LOGIN_FAILED', 'AUTH', user.id, 'Account deactivated', null, { email }, ipAddress, userAgent);
      throw new ForbiddenError('Account is deactivated. Contact admin.');
    }

    // Verify password
    const isValidPassword = await UserModel.verifyPassword(password, user.password!);
    if (!isValidPassword) {
      await this.incrementFailedAttempts(user.id);
      await AuditLogService.logFailure('LOGIN_FAILED', 'AUTH', user.id, 'Invalid password', null, { email }, ipAddress, userAgent);
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if 2FA is enabled
    const has2FA = await TOTPService.is2FAEnabled(user.id);
    if (has2FA) {
      if (!twoFactorCode) {
        // Return response indicating 2FA is required
        // Generate a temporary token for 2FA verification
        const tempToken = jwt.sign({ userId: user.id, pending2FA: true }, config.sessionSecret, { expiresIn: '5m' });
        return {
          success: false,
          message: 'Two-factor authentication required',
          requires2FA: true,
          tempToken,
        };
      }

      // Verify 2FA code
      const is2FAValid = await TOTPService.verify2FALogin(user.id, twoFactorCode);
      if (!is2FAValid) {
        await AuditLogService.logFailure('LOGIN_2FA', 'AUTH', user.id, 'Invalid 2FA code', null, { email }, ipAddress, userAgent);
        throw new UnauthorizedError('Invalid two-factor authentication code');
      }
    }

    // Reset failed attempts on successful login
    await this.resetFailedAttempts(user.id);

    // Generate tokens (using new refresh token system)
    const tokens = await TokenService.generateTokenPair(user);
    
    // Update last login
    await TokenService.updateLastLogin(user.id);

    // Log successful login
    await AuditLogService.logSuccess('LOGIN', 'AUTH', user.id, null, { email, has2FA }, ipAddress, userAgent);

    // Remove sensitive data from response
    const { password: _, security_pin: __, two_factor_secret: ___, ...userWithoutSecrets } = user;

    return {
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: userWithoutSecrets,
      mustChangePassword: false,
    };
  }

  // Complete 2FA verification (for pending login)
  static async verify2FALogin(
    tempToken: string,
    twoFactorCode: string,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<LoginResponseWithTokens> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    // Verify temp token
    let payload: { userId: number; pending2FA: boolean };
    try {
      payload = jwt.verify(tempToken, config.sessionSecret) as { userId: number; pending2FA: boolean };
    } catch {
      throw new UnauthorizedError('Session expired. Please login again.');
    }

    if (!payload.pending2FA) {
      throw new BadRequestError('Invalid verification request.');
    }

    const user = await UserModel.findById(payload.userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify 2FA code
    const is2FAValid = await TOTPService.verify2FALogin(user.id, twoFactorCode);
    if (!is2FAValid) {
      await AuditLogService.logFailure('LOGIN_2FA', 'AUTH', user.id, 'Invalid 2FA code', null, {}, ipAddress, userAgent);
      throw new UnauthorizedError('Invalid two-factor authentication code');
    }

    // Generate tokens
    const tokens = await TokenService.generateTokenPair(user);
    await TokenService.updateLastLogin(user.id);

    await AuditLogService.logSuccess('LOGIN_2FA', 'AUTH', user.id, null, {}, ipAddress, userAgent);

    const { password: _, security_pin: __, two_factor_secret: ___, ...userWithoutSecrets } = user;

    return {
      success: true,
      message: 'Login successful',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: userWithoutSecrets,
      mustChangePassword: user.must_change_password,
    };
  }

  // Refresh tokens
  static async refreshTokens(
    refreshToken: string,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<LoginResponseWithTokens> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    const result = await TokenService.refreshTokens(refreshToken);
    
    await AuditLogService.logSuccess('TOKEN_REFRESH', 'AUTH', result.user.id, null, {}, ipAddress, userAgent);

    const { password: _, security_pin: __, two_factor_secret: ___, ...userWithoutSecrets } = result.user;

    return {
      success: true,
      message: 'Tokens refreshed successfully',
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: userWithoutSecrets,
    };
  }

  // Logout (revoke refresh token)
  static async logout(
    refreshToken: string,
    userId: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<void> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    await TokenService.revokeToken(refreshToken);
    await AuditLogService.logSuccess('LOGOUT', 'AUTH', userId, null, {}, ipAddress, userAgent);
  }

  // Logout from all devices
  static async logoutAll(
    userId: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<number> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    const count = await TokenService.revokeAllUserTokens(userId);
    await AuditLogService.logSuccess('LOGOUT', 'AUTH', userId, null, { allDevices: true, sessionsRevoked: count }, ipAddress, userAgent);
    return count;
  }

  // Legacy login (for backwards compatibility)
  static async login(credentials: LoginRequest): Promise<LoginResponse & { mustChangePassword?: boolean }> {
    const { email, password } = credentials;

    // Find user by email
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new ForbiddenError('Account is deactivated. Contact admin.');
    }

    // Verify password
    const isValidPassword = await UserModel.verifyPassword(password, user.password!);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate token
    const token = this.generateToken(user);

    // Remove sensitive data from response
    const { password: _, security_pin: __, ...userWithoutSecrets } = user;

    return {
      success: true,
      message: user.must_change_password ? 'Please change your password' : 'Login successful',
      token,
      user: userWithoutSecrets,
      mustChangePassword: user.must_change_password,
    };
  }

  // Get user from token (for /me endpoint)
  static async getUserFromToken(token: string): Promise<User> {
    const payload = this.verifyToken(token);
    const user = await UserModel.findById(payload.userId);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    if (!user.is_active) {
      throw new ForbiddenError('Account is deactivated');
    }

    return user;
  }

  // ==========================================
  // Password Management with Strength Validation
  // ==========================================

  // Validate password strength
  static validatePasswordStrength(
    password: string,
    userInfo?: { name?: string; email?: string }
  ): { isValid: boolean; score: number; strengthLabel: string; errors: string[]; suggestions: string[] } {
    const result = validatePassword(password, {}, userInfo);
    return {
      ...result,
      strengthLabel: getPasswordStrengthLabel(result.score),
    };
  }

  // First-time password setup (self) with strength validation
  static async setupPassword(
    userId: number,
    data: SetupPasswordRequest,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<void> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };
    const user = await UserModel.findByEmail((await UserModel.findById(userId))?.email || '');
    if (!user) throw new NotFoundError('User not found');

    // Verify old password
    const isValidPassword = await UserModel.verifyPassword(data.oldPassword, user.password!);
    if (!isValidPassword) {
      await AuditLogService.logFailure('PASSWORD_SETUP', 'USER', userId, 'Invalid current password', userId, {}, ipAddress, userAgent);
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Verify passwords match
    if (data.newPassword !== data.confirmPassword) {
      throw new BadRequestError('Passwords do not match');
    }

    // Validate password strength
    const validation = this.validatePasswordStrength(data.newPassword, { name: user.name, email: user.email });
    if (!validation.isValid) {
      throw new BadRequestError(`Password too weak: ${validation.errors.join('. ')}`);
    }

    // Validate PIN (6 digits)
    if (!/^\d{6}$/.test(data.securityPin)) {
      throw new BadRequestError('Security PIN must be exactly 6 digits');
    }

    await UserModel.setupPassword(userId, data.newPassword, data.securityPin);
    await AuditLogService.logSuccess('PASSWORD_SETUP', 'USER', userId, userId, {}, ipAddress, userAgent);
  }

  // Self password change with strength validation
  static async changePassword(
    userId: number,
    data: ChangePasswordRequest,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<void> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };
    const user = await UserModel.findById(userId, true);
    if (!user) throw new NotFoundError('User not found');

    // Check if user can change password
    const canChange = UserModel.canChangePassword(user);
    if (!canChange.canChange) {
      throw new ForbiddenError(canChange.reason || 'You cannot change your password');
    }

    // Verify old password
    const isValidPassword = await UserModel.verifyPassword(data.oldPassword, user.password!);
    if (!isValidPassword) {
      await AuditLogService.logFailure('PASSWORD_CHANGE', 'USER', userId, 'Invalid current password', userId, {}, ipAddress, userAgent);
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Verify passwords match
    if (data.newPassword !== data.confirmPassword) {
      throw new BadRequestError('Passwords do not match');
    }

    // Validate password strength
    const validation = this.validatePasswordStrength(data.newPassword, { name: user.name, email: user.email });
    if (!validation.isValid) {
      throw new BadRequestError(`Password too weak: ${validation.errors.join('. ')}`);
    }

    await UserModel.changePassword(userId, data.newPassword);
    await AuditLogService.logSuccess('PASSWORD_CHANGE', 'USER', userId, userId, {}, ipAddress, userAgent);
  }

  // Check if user can change password
  static async canChangePassword(userId: number): Promise<CanChangePasswordResponse> {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    // If must change password (first time), they need to setup with PIN
    if (user.must_change_password) {
      return { canChange: true, mustSetupFirst: true };
    }

    const result = UserModel.canChangePassword(user);
    return { 
      canChange: result.canChange, 
      reason: result.reason,
      mustSetupFirst: false 
    };
  }

  // ==========================================
  // 2FA Management
  // ==========================================

  static async setup2FA(userId: number): Promise<{ secret: string; qrCode: string; otpAuthUrl: string }> {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    return TOTPService.setup2FA(userId, user.email);
  }

  static async enable2FA(
    userId: number,
    code: string,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<boolean> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    const result = await TOTPService.enable2FA(userId, code);
    await AuditLogService.logSuccess('2FA_ENABLE', 'USER', userId, userId, {}, ipAddress, userAgent);
    return result;
  }

  static async disable2FA(
    userId: number,
    code: string,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<boolean> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    const result = await TOTPService.disable2FA(userId, code);
    await AuditLogService.logSuccess('2FA_DISABLE', 'USER', userId, userId, {}, ipAddress, userAgent);
    return result;
  }

  static async is2FAEnabled(userId: number): Promise<boolean> {
    return TOTPService.is2FAEnabled(userId);
  }

  // ==========================================
  // OTP Management
  // ==========================================

  static async sendLoginOTP(email: string): Promise<boolean> {
    const user = await UserModel.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return true;
    }
    return OTPService.sendLoginOTP(user.id, user.email, user.name);
  }

  static async sendPasswordResetOTP(email: string): Promise<boolean> {
    const user = await UserModel.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists
      return true;
    }
    return OTPService.sendPasswordResetOTP(user.id, user.email, user.name);
  }

  static async verifyOTP(email: string, code: string, type: 'LOGIN' | 'PASSWORD_RESET'): Promise<boolean> {
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new BadRequestError('Invalid verification request');
    }
    return OTPService.verifyOTP(user.id, code, type);
  }

  // ==========================================
  // Admin Functions
  // ==========================================

  // Create new user (Admin only) with password validation
  static async createUser(
    userData: CreateUserRequest,
    adminId?: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<User> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    // Validate password strength for new user
    const validation = this.validatePasswordStrength(userData.password, { name: userData.name, email: userData.email });
    if (!validation.isValid) {
      throw new BadRequestError(`Password too weak: ${validation.errors.join('. ')}`);
    }

    const user = await UserModel.create(userData);
    await AuditLogService.logSuccess('USER_CREATE', 'USER', adminId || null, user.id, { email: userData.email, role: userData.role }, ipAddress, userAgent);
    return user;
  }

  // Update user (Admin only)
  static async updateUser(
    userId: number,
    userData: UpdateUserRequest,
    adminId?: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<User> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    const user = await UserModel.update(userId, userData);
    await AuditLogService.logSuccess('USER_UPDATE', 'USER', adminId || null, userId, userData as unknown as Record<string, unknown>, ipAddress, userAgent);
    return user;
  }

  // Simple password reset (Admin only - for legacy/simple reset without PIN)
  static async resetPassword(userId: number, newPassword: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    // Validate password strength
    const validation = this.validatePasswordStrength(newPassword, { name: user.name, email: user.email });
    if (!validation.isValid) {
      throw new BadRequestError(`Password too weak: ${validation.errors.join('. ')}`);
    }

    await UserModel.resetPassword(userId, newPassword);
  }

  // Admin reset password with PIN verification
  static async adminResetPassword(
    userId: number,
    newPassword: string,
    securityPin: string,
    adminId?: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<void> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };
    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    // Verify the user's security PIN
    const hasPin = await UserModel.hasSecurityPin(userId);
    if (!hasPin) {
      throw new BadRequestError('User has not set up their security PIN yet. They must complete first-time password setup first.');
    }

    const isPinValid = await UserModel.verifySecurityPin(userId, securityPin);
    if (!isPinValid) {
      await AuditLogService.logFailure('PASSWORD_RESET', 'USER', adminId || null, 'Invalid PIN', userId, {}, ipAddress, userAgent);
      throw new UnauthorizedError('Invalid security PIN. Please ask the user for their correct PIN.');
    }

    // Validate password strength
    const validation = this.validatePasswordStrength(newPassword, { name: user.name, email: user.email });
    if (!validation.isValid) {
      throw new BadRequestError(`Password too weak: ${validation.errors.join('. ')}`);
    }

    await UserModel.resetPassword(userId, newPassword);
    await AuditLogService.logSuccess('PASSWORD_RESET', 'USER', adminId || null, userId, {}, ipAddress, userAgent);
  }

  // Check if user has PIN (for admin UI)
  static async userHasPin(userId: number): Promise<boolean> {
    return UserModel.hasSecurityPin(userId);
  }

  // Deactivate user (Admin only)
  static async deactivateUser(
    userId: number,
    adminId?: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<void> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    await UserModel.deactivate(userId);
    // Revoke all user tokens
    await TokenService.revokeAllUserTokens(userId);
    await AuditLogService.logSuccess('USER_DEACTIVATE', 'USER', adminId || null, userId, {}, ipAddress, userAgent);
  }

  // Activate user (Admin only)
  static async activateUser(
    userId: number,
    adminId?: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<void> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    await UserModel.activate(userId);
    await AuditLogService.logSuccess('USER_ACTIVATE', 'USER', adminId || null, userId, {}, ipAddress, userAgent);
  }

  // Delete user (Admin only)
  static async deleteUser(
    userId: number,
    adminId?: number,
    requestInfo?: { ip?: string; headers?: Record<string, string | string[] | undefined> }
  ): Promise<void> {
    const { ipAddress, userAgent } = requestInfo ? getRequestInfo(requestInfo) : { ipAddress: null, userAgent: null };

    const user = await UserModel.findById(userId);
    if (!user) throw new NotFoundError('User not found');

    await UserModel.delete(userId);
    await AuditLogService.logSuccess('USER_DELETE', 'USER', adminId || null, userId, { email: user.email }, ipAddress, userAgent);
  }

  // Get all users (Admin only)
  static async getAllUsers(): Promise<User[]> {
    return UserModel.getAll();
  }

  // Get all residents (for dropdowns)
  static async getResidents(): Promise<User[]> {
    return UserModel.getAllResidents();
  }

  // Get audit logs (Admin only)
  static async getAuditLogs(query: {
    userId?: number;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }) {
    return AuditLogService.getLogs(query as any);
  }

  // Get security events (Admin only)
  static async getSecurityEvents(limit: number = 50) {
    return AuditLogService.getSecurityEvents(limit);
  }
}

export default AuthService;
