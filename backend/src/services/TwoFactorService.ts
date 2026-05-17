import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { EmailService } from './EmailService';
import { BadRequestError, NotFoundError } from '../utils/errors';

// =====================================================
// OTP Types
// =====================================================

export type OTPType = 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFY';

export interface OTPRecord {
  id: number;
  user_id: number;
  code: string;
  type: OTPType;
  expires_at: Date;
  used: boolean;
  attempts: number;
  created_at: Date;
}

export interface TOTPSetup {
  secret: string;
  otpAuthUrl: string;
  qrCode: string;
}

// =====================================================
// OTP Service
// =====================================================

export class OTPService {
  private static OTP_LENGTH = 6;
  private static OTP_EXPIRY_MINUTES = {
    LOGIN: 5,
    PASSWORD_RESET: 10,
    EMAIL_VERIFY: 30,
  };
  private static MAX_ATTEMPTS = 3;

  /**
   * Generate a random 6-digit OTP
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create and store a new OTP for a user
   */
  static async createOTP(userId: number, type: OTPType): Promise<string> {
    // Invalidate any existing OTPs of the same type
    await pool.execute(
      'UPDATE otp_codes SET used = TRUE WHERE user_id = ? AND type = ? AND used = FALSE',
      [userId, type]
    );

    const code = this.generateOTP();
    const expiryMinutes = this.OTP_EXPIRY_MINUTES[type];
    
    await pool.execute(
      `INSERT INTO otp_codes (user_id, code, type, expires_at) 
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [userId, code, type, expiryMinutes]
    );

    return code;
  }

  /**
   * Verify an OTP
   */
  static async verifyOTP(userId: number, code: string, type: OTPType): Promise<boolean> {
    // Get the latest valid OTP
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM otp_codes 
       WHERE user_id = ? AND type = ? AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId, type]
    );

    if (rows.length === 0) {
      throw new BadRequestError('No valid OTP found. Please request a new one.');
    }

    const otp = rows[0] as OTPRecord;

    // Check max attempts
    if (otp.attempts >= this.MAX_ATTEMPTS) {
      await pool.execute('UPDATE otp_codes SET used = TRUE WHERE id = ?', [otp.id]);
      throw new BadRequestError('Maximum OTP attempts exceeded. Please request a new one.');
    }

    // Increment attempts
    await pool.execute(
      'UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?',
      [otp.id]
    );

    // Verify code
    if (otp.code !== code) {
      const remainingAttempts = this.MAX_ATTEMPTS - otp.attempts - 1;
      if (remainingAttempts <= 0) {
        await pool.execute('UPDATE otp_codes SET used = TRUE WHERE id = ?', [otp.id]);
        throw new BadRequestError('Invalid OTP. Maximum attempts exceeded. Please request a new one.');
      }
      throw new BadRequestError(`Invalid OTP. ${remainingAttempts} attempts remaining.`);
    }

    // Mark as used
    await pool.execute('UPDATE otp_codes SET used = TRUE WHERE id = ?', [otp.id]);

    return true;
  }

  /**
   * Send login OTP via email
   */
  static async sendLoginOTP(userId: number, email: string, userName: string): Promise<boolean> {
    const code = await this.createOTP(userId, 'LOGIN');
    return EmailService.sendLoginOTP(email, code, userName);
  }

  /**
   * Send password reset OTP via email
   */
  static async sendPasswordResetOTP(userId: number, email: string, userName: string): Promise<boolean> {
    const code = await this.createOTP(userId, 'PASSWORD_RESET');
    return EmailService.sendPasswordResetOTP(email, code, userName);
  }

  /**
   * Cleanup expired OTPs
   */
  static async cleanup(): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM otp_codes WHERE expires_at < NOW() OR used = TRUE'
    );
    return result.affectedRows;
  }
}

// =====================================================
// TOTP (Time-based OTP) Service for 2FA
// =====================================================

export class TOTPService {
  private static APP_NAME = 'VPM System';

  /**
   * Generate a new TOTP secret for 2FA setup
   */
  static generateSecret(email: string): { secret: string; otpAuthUrl: string } {
    const secret = speakeasy.generateSecret({
      name: `${this.APP_NAME}:${email}`,
      issuer: this.APP_NAME,
      length: 32,
    });

    return {
      secret: secret.base32,
      otpAuthUrl: secret.otpauth_url!,
    };
  }

  /**
   * Generate QR code for authenticator app
   */
  static async generateQRCode(otpAuthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpAuthUrl);
  }

  /**
   * Setup 2FA for a user - returns secret and QR code
   */
  static async setup2FA(userId: number, email: string): Promise<TOTPSetup> {
    const { secret, otpAuthUrl } = this.generateSecret(email);
    const qrCode = await this.generateQRCode(otpAuthUrl);

    // Store the secret temporarily (not enabled yet until verified)
    await pool.execute(
      'UPDATE users SET two_factor_secret = ? WHERE id = ?',
      [secret, userId]
    );

    return {
      secret,
      otpAuthUrl,
      qrCode,
    };
  }

  /**
   * Verify TOTP token
   */
  static verifyToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // Allow 1 step before/after for clock drift
    });
  }

  /**
   * Enable 2FA after verifying the first token
   */
  static async enable2FA(userId: number, token: string): Promise<boolean> {
    // Get user's temporary secret
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT two_factor_secret, email, name FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = rows[0];
    
    if (!user.two_factor_secret) {
      throw new BadRequestError('2FA setup not initiated. Please start setup first.');
    }

    // Verify the token
    const isValid = this.verifyToken(user.two_factor_secret, token);
    
    if (!isValid) {
      throw new BadRequestError('Invalid verification code. Please try again.');
    }

    // Enable 2FA
    await pool.execute(
      'UPDATE users SET two_factor_enabled = TRUE WHERE id = ?',
      [userId]
    );

    // Send notification email
    await EmailService.send2FAEnabledNotification(user.email, user.name);

    return true;
  }

  /**
   * Disable 2FA for a user
   */
  static async disable2FA(userId: number, token: string): Promise<boolean> {
    // Get user's secret
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = rows[0];
    
    if (!user.two_factor_enabled) {
      throw new BadRequestError('2FA is not enabled on this account.');
    }

    // Verify the token before disabling
    const isValid = this.verifyToken(user.two_factor_secret, token);
    
    if (!isValid) {
      throw new BadRequestError('Invalid verification code. Cannot disable 2FA.');
    }

    // Disable 2FA and clear secret
    await pool.execute(
      'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = ?',
      [userId]
    );

    return true;
  }

  /**
   * Verify 2FA token during login
   */
  static async verify2FALogin(userId: number, token: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = rows[0];
    
    if (!user.two_factor_enabled) {
      return true; // 2FA not enabled, skip verification
    }

    return this.verifyToken(user.two_factor_secret, token);
  }

  /**
   * Check if user has 2FA enabled
   */
  static async is2FAEnabled(userId: number): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT two_factor_enabled FROM users WHERE id = ?',
      [userId]
    );

    return rows.length > 0 && rows[0].two_factor_enabled === 1;
  }
}

export default { OTPService, TOTPService };
