import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services';
import { UserModel } from '../models';
import { successResponse } from '../utils/helpers';
import { LoginRequest, CreateUserRequest, UpdateUserRequest, ResetPasswordRequest, SetupPasswordRequest, ChangePasswordRequest } from '../types';
import { BadRequestError } from '../utils/errors';

export class AuthController {
  // POST /api/auth/login - Enhanced login with 2FA support
  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const credentials: LoginRequest & { twoFactorCode?: string } = req.body;
      
      if (!credentials.email || !credentials.password) {
        throw new BadRequestError('Email and password are required');
      }

      const result = await AuthService.loginEnhanced(credentials, req);
      
      // If 2FA is required, return partial response
      if (result.requires2FA) {
        res.json({
          success: true,
          message: result.message,
          data: {
            requires2FA: true,
            tempToken: result.tempToken,
          }
        });
        return;
      }

      res.json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          // Legacy support - also include as token
          token: result.accessToken,
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/verify-2fa - Complete 2FA verification
  static async verify2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tempToken, code } = req.body;
      
      if (!tempToken || !code) {
        throw new BadRequestError('Temporary token and 2FA code are required');
      }

      const result = await AuthService.verify2FALogin(tempToken, code, req);
      
      res.json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          token: result.accessToken,
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/refresh - Refresh tokens
  static async refreshTokens(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        throw new BadRequestError('Refresh token is required');
      }

      const result = await AuthService.refreshTokens(refreshToken, req);
      
      res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          token: result.accessToken,
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/logout - Logout (revoke refresh token)
  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken && req.user) {
        await AuthService.logout(refreshToken, req.user.id, req);
      }

      res.json(successResponse(null, 'Logged out successfully'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/logout-all - Logout from all devices
  static async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const count = await AuthService.logoutAll(req.user.id, req);
      res.json(successResponse({ sessionsRevoked: count }, `Logged out from ${count} sessions`));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/me - Get current authenticated user
  static async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const user = await UserModel.findById(req.user.id);
      res.json(successResponse(user, 'User retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/residents (for dropdowns - authenticated users only)
  static async getResidents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residents = await AuthService.getResidents();
      res.json(successResponse(residents, 'Residents retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // 2FA MANAGEMENT ROUTES
  // ==========================================

  // POST /api/auth/2fa/setup - Start 2FA setup (get QR code)
  static async setup2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const result = await AuthService.setup2FA(req.user.id);
      res.json(successResponse(result, 'Scan the QR code with your authenticator app'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/2fa/enable - Enable 2FA (verify code)
  static async enable2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const { code } = req.body;
      if (!code) {
        throw new BadRequestError('Verification code is required');
      }

      await AuthService.enable2FA(req.user.id, code, req);
      res.json(successResponse(null, 'Two-factor authentication enabled successfully'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/2fa/disable - Disable 2FA
  static async disable2FA(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const { code } = req.body;
      if (!code) {
        throw new BadRequestError('Verification code is required to disable 2FA');
      }

      await AuthService.disable2FA(req.user.id, code, req);
      res.json(successResponse(null, 'Two-factor authentication disabled'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/2fa/status - Check 2FA status
  static async get2FAStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const isEnabled = await AuthService.is2FAEnabled(req.user.id);
      res.json(successResponse({ enabled: isEnabled }, isEnabled ? '2FA is enabled' : '2FA is not enabled'));
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PASSWORD VALIDATION
  // ==========================================

  // POST /api/auth/validate-password - Validate password strength
  static async validatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { password, name, email } = req.body;
      
      if (!password) {
        throw new BadRequestError('Password is required');
      }

      const result = AuthService.validatePasswordStrength(password, { name, email });
      res.json(successResponse(result, result.isValid ? 'Password is strong enough' : 'Password does not meet requirements'));
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // OTP ROUTES
  // ==========================================

  // POST /api/auth/otp/send - Send OTP to email
  static async sendOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, type } = req.body;
      
      if (!email || !type) {
        throw new BadRequestError('Email and OTP type are required');
      }

      if (type === 'LOGIN') {
        await AuthService.sendLoginOTP(email);
      } else if (type === 'PASSWORD_RESET') {
        await AuthService.sendPasswordResetOTP(email);
      } else {
        throw new BadRequestError('Invalid OTP type');
      }

      // Always return success to prevent email enumeration
      res.json(successResponse(null, 'If the email exists, an OTP has been sent'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/otp/verify - Verify OTP
  static async verifyOTP(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code, type } = req.body;
      
      if (!email || !code || !type) {
        throw new BadRequestError('Email, code and type are required');
      }

      await AuthService.verifyOTP(email, code, type);
      res.json(successResponse(null, 'OTP verified successfully'));
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // ADMIN ONLY ROUTES - User Management
  // ==========================================

  // GET /api/auth/users - Get all users (Admin only)
  static async getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await AuthService.getAllUsers();
      res.json(successResponse(users, 'Users retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/users - Create new user (Admin only)
  static async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userData: CreateUserRequest = req.body;
      
      if (!userData.name || !userData.email || !userData.password || !userData.role) {
        throw new BadRequestError('Name, email, password and role are required');
      }

      const user = await AuthService.createUser(userData, req.user?.id, req);
      res.status(201).json(successResponse(user, 'User created successfully'));
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/auth/users/:id - Update user (Admin only)
  static async updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const userData: UpdateUserRequest = req.body;
      
      const user = await AuthService.updateUser(userId, userData, req.user?.id, req);
      res.json(successResponse(user, 'User updated successfully'));
    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/auth/users/:id - Delete user (Admin only)
  static async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // Prevent self-deletion
      if (req.user && req.user.id === userId) {
        throw new BadRequestError('Cannot delete your own account');
      }

      await AuthService.deleteUser(userId, req.user?.id, req);
      res.json(successResponse(null, 'User deleted successfully'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/users/:id/reset-password - Reset user password (Admin only)
  static async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const { newPassword }: ResetPasswordRequest = req.body;
      
      if (!newPassword || newPassword.length < 8) {
        throw new BadRequestError('Password must be at least 8 characters');
      }

      await AuthService.resetPassword(userId, newPassword);
      res.json(successResponse(null, 'Password reset successfully'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/users/:id/deactivate - Deactivate user (Admin only)
  static async deactivateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      
      // Prevent self-deactivation
      if (req.user && req.user.id === userId) {
        throw new BadRequestError('Cannot deactivate your own account');
      }

      await AuthService.deactivateUser(userId, req.user?.id, req);
      res.json(successResponse(null, 'User deactivated successfully'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/users/:id/activate - Activate user (Admin only)
  static async activateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      await AuthService.activateUser(userId, req.user?.id, req);
      res.json(successResponse(null, 'User activated successfully'));
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // PASSWORD MANAGEMENT ROUTES
  // ==========================================

  // POST /api/auth/setup-password - First time password setup with PIN (for new users)
  static async setupPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const { oldPassword, newPassword, confirmPassword, securityPin }: SetupPasswordRequest = req.body;

      // Validate required fields
      if (!oldPassword || !newPassword || !confirmPassword || !securityPin) {
        throw new BadRequestError('Old password, new password, confirm password and security PIN are required');
      }

      // Validate password match
      if (newPassword !== confirmPassword) {
        throw new BadRequestError('New password and confirm password do not match');
      }

      // Validate PIN format (6 digits)
      if (!/^\d{6}$/.test(securityPin)) {
        throw new BadRequestError('Security PIN must be exactly 6 digits');
      }

      await AuthService.setupPassword(req.user.id, { oldPassword, newPassword, confirmPassword, securityPin }, req);
      
      // Fetch updated user data to return to frontend
      const updatedUser = await UserModel.findById(req.user.id);
      const { password: _, security_pin: __, two_factor_secret: ___, ...userWithoutSecrets } = updatedUser || {};
      
      res.json(successResponse({ user: userWithoutSecrets }, 'Password setup completed successfully'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/change-password - Change own password (with restrictions for non-admins)
  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const { oldPassword, newPassword, confirmPassword }: ChangePasswordRequest = req.body;

      // Validate required fields
      if (!oldPassword || !newPassword || !confirmPassword) {
        throw new BadRequestError('Old password, new password and confirm password are required');
      }

      // Validate password match
      if (newPassword !== confirmPassword) {
        throw new BadRequestError('New password and confirm password do not match');
      }

      await AuthService.changePassword(req.user.id, { oldPassword, newPassword, confirmPassword }, req);
      res.json(successResponse(null, 'Password changed successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/can-change-password - Check if current user can change password
  static async canChangePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
      }

      const result = await AuthService.canChangePassword(req.user.id);
      res.json(successResponse(result, 'Password change eligibility checked'));
    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/users/:id/admin-reset-password - Admin reset password with PIN verification
  static async adminResetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const { securityPin, newPassword }: ResetPasswordRequest = req.body;

      if (!securityPin) {
        throw new BadRequestError('User security PIN is required for verification');
      }

      if (!newPassword || newPassword.length < 8) {
        throw new BadRequestError('New password must be at least 8 characters');
      }

      // Prevent resetting own password through this route
      if (req.user && req.user.id === userId) {
        throw new BadRequestError('Use change-password route to change your own password');
      }

      await AuthService.adminResetPassword(userId, newPassword, securityPin, req.user?.id, req);
      res.json(successResponse(null, 'Password reset successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/users/:id/has-pin - Check if user has set up their PIN (Admin only)
  static async userHasPin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseInt(req.params.id, 10);
      const hasPin = await AuthService.userHasPin(userId);
      res.json(successResponse({ hasPin }, hasPin ? 'User has PIN set up' : 'User has not set up PIN yet'));
    } catch (error) {
      next(error);
    }
  }

  // ==========================================
  // AUDIT LOG ROUTES (Admin only)
  // ==========================================

  // GET /api/auth/audit-logs - Get audit logs
  static async getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId, action, startDate, endDate, limit } = req.query;
      
      const logs = await AuthService.getAuditLogs({
        userId: userId ? parseInt(userId as string, 10) : undefined,
        action: action as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: limit ? parseInt(limit as string, 10) : 100,
      });

      res.json(successResponse(logs, 'Audit logs retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/security-events - Get recent security events
  static async getSecurityEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const events = await AuthService.getSecurityEvents(limit);
      res.json(successResponse(events, 'Security events retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export default AuthController;
