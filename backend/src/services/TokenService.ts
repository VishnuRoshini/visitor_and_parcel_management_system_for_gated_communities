import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { config } from '../config';
import { User, JwtPayload } from '../types';
import { UnauthorizedError } from '../utils/errors';

// =====================================================
// Token Configuration
// =====================================================

// Access token: Short-lived (15 minutes)
const ACCESS_TOKEN_EXPIRY = '15m';
const ACCESS_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

// Refresh token: Long-lived (7 days)
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// =====================================================
// Token Types
// =====================================================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Access token expiry in seconds
}

export interface RefreshTokenRecord {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
  revoked: boolean;
  revoked_at: Date | null;
  replaced_by: string | null;
}

// =====================================================
// Token Service
// =====================================================

export class TokenService {
  /**
   * Generate access token (short-lived JWT)
   */
  static generateAccessToken(user: User): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };
    
    return jwt.sign(payload, config.sessionSecret, { expiresIn: ACCESS_TOKEN_EXPIRY });
  }

  /**
   * Generate refresh token (random UUID stored in DB)
   */
  static async generateRefreshToken(userId: number): Promise<string> {
    const token = uuidv4();
    
    await pool.execute(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) 
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
      [userId, token, REFRESH_TOKEN_EXPIRY_DAYS]
    );

    return token;
  }

  /**
   * Generate both access and refresh tokens
   */
  static async generateTokenPair(user: User): Promise<TokenPair> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY_MS / 1000), // 900 seconds = 15 minutes
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.sessionSecret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Access token expired. Please refresh.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid access token.');
      }
      throw new UnauthorizedError('Authentication failed.');
    }
  }

  /**
   * Verify and rotate refresh token
   * Returns new token pair and invalidates old refresh token
   */
  static async refreshTokens(refreshToken: string): Promise<TokenPair & { user: User }> {
    // Find the refresh token
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT rt.*, u.id as user_id, u.name, u.email, u.role, u.is_active, 
              u.contact_info, u.must_change_password, u.password_changed_count,
              u.two_factor_enabled
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = ?`,
      [refreshToken]
    );

    if (rows.length === 0) {
      throw new UnauthorizedError('Invalid refresh token.');
    }

    const tokenRecord = rows[0];

    // Check if token is revoked
    if (tokenRecord.revoked) {
      // Possible token reuse attack - revoke all tokens for this user
      await this.revokeAllUserTokens(tokenRecord.user_id);
      throw new UnauthorizedError('Refresh token has been revoked. Please login again.');
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      throw new UnauthorizedError('Refresh token expired. Please login again.');
    }

    // Check if user is active
    if (!tokenRecord.is_active) {
      await this.revokeToken(refreshToken);
      throw new UnauthorizedError('Account is deactivated.');
    }

    // Create user object
    const user: User = {
      id: tokenRecord.user_id,
      name: tokenRecord.name,
      email: tokenRecord.email,
      role: tokenRecord.role,
      is_active: tokenRecord.is_active,
      contact_info: tokenRecord.contact_info,
      must_change_password: tokenRecord.must_change_password,
      password_changed_count: tokenRecord.password_changed_count,
      created_at: tokenRecord.created_at,
      updated_at: tokenRecord.updated_at,
    };

    // Generate new token pair
    const newTokens = await this.generateTokenPair(user);

    // Revoke old refresh token (token rotation)
    await pool.execute(
      `UPDATE refresh_tokens 
       SET revoked = TRUE, revoked_at = NOW(), replaced_by = ? 
       WHERE token = ?`,
      [newTokens.refreshToken, refreshToken]
    );

    return {
      ...newTokens,
      user,
    };
  }

  /**
   * Revoke a specific refresh token
   */
  static async revokeToken(token: string): Promise<void> {
    await pool.execute(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE token = ?',
      [token]
    );
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   */
  static async revokeAllUserTokens(userId: number): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE refresh_tokens SET revoked = TRUE, revoked_at = NOW() WHERE user_id = ? AND revoked = FALSE',
      [userId]
    );
    return result.affectedRows;
  }

  /**
   * Get active sessions for a user
   */
  static async getActiveSessions(userId: number): Promise<RefreshTokenRecord[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT id, created_at, expires_at 
       FROM refresh_tokens 
       WHERE user_id = ? AND revoked = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows as RefreshTokenRecord[];
  }

  /**
   * Cleanup expired and revoked tokens
   */
  static async cleanup(): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW() OR revoked = TRUE'
    );
    return result.affectedRows;
  }

  /**
   * Update user's last login timestamp
   */
  static async updateLastLogin(userId: number): Promise<void> {
    await pool.execute(
      'UPDATE users SET last_login = NOW() WHERE id = ?',
      [userId]
    );
  }
}

export default TokenService;
