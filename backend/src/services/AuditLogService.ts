import { pool } from '../config/database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// =====================================================
// Audit Log Types
// =====================================================

export type AuditAction = 
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'LOGIN_2FA'
  | 'PASSWORD_CHANGE' | 'PASSWORD_RESET' | 'PASSWORD_SETUP'
  | 'USER_CREATE' | 'USER_UPDATE' | 'USER_DELETE' | 'USER_ACTIVATE' | 'USER_DEACTIVATE'
  | 'VISITOR_CREATE' | 'VISITOR_UPDATE' | 'VISITOR_STATUS_CHANGE'
  | 'PARCEL_CREATE' | 'PARCEL_UPDATE' | 'PARCEL_STATUS_CHANGE'
  | '2FA_ENABLE' | '2FA_DISABLE' | '2FA_VERIFY'
  | 'OTP_REQUEST' | 'OTP_VERIFY' | 'OTP_FAILED'
  | 'TOKEN_REFRESH' | 'TOKEN_REVOKE'
  | 'ADMIN_ACTION' | 'SECURITY_EVENT';

export type AuditEntityType = 
  | 'USER' | 'VISITOR' | 'PARCEL' | 'SESSION' | 'SYSTEM' | 'AUTH';

export type AuditStatus = 'SUCCESS' | 'FAILURE';

export interface AuditLogEntry {
  id?: number;
  user_id: number | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: AuditStatus;
  error_message: string | null;
  created_at?: Date;
}

export interface AuditLogQuery {
  userId?: number;
  action?: AuditAction;
  entityType?: AuditEntityType;
  entityId?: number;
  status?: AuditStatus;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// =====================================================
// Audit Log Service
// =====================================================

export class AuditLogService {
  /**
   * Create a new audit log entry
   */
  static async log(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<number> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, details, ip_address, user_agent, status, error_message) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.user_id,
          entry.action,
          entry.entity_type,
          entry.entity_id,
          entry.details ? JSON.stringify(entry.details) : null,
          entry.ip_address,
          entry.user_agent,
          entry.status,
          entry.error_message,
        ]
      );
      return result.insertId;
    } catch (error) {
      // Don't throw - audit logging should not break the application
      console.error('Failed to write audit log:', error);
      return 0;
    }
  }

  /**
   * Log a successful action
   */
  static async logSuccess(
    action: AuditAction,
    entityType: AuditEntityType,
    userId: number | null,
    entityId: number | null = null,
    details: Record<string, unknown> | null = null,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<number> {
    return this.log({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
      status: 'SUCCESS',
      error_message: null,
    });
  }

  /**
   * Log a failed action
   */
  static async logFailure(
    action: AuditAction,
    entityType: AuditEntityType,
    userId: number | null,
    errorMessage: string,
    entityId: number | null = null,
    details: Record<string, unknown> | null = null,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<number> {
    return this.log({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
      ip_address: ipAddress,
      user_agent: userAgent,
      status: 'FAILURE',
      error_message: errorMessage,
    });
  }

  /**
   * Get audit logs with filters
   */
  static async getLogs(query: AuditLogQuery = {}): Promise<AuditLogEntry[]> {
    let sql = `
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params: (string | number | Date)[] = [];

    if (query.userId) {
      sql += ' AND al.user_id = ?';
      params.push(query.userId);
    }

    if (query.action) {
      sql += ' AND al.action = ?';
      params.push(query.action);
    }

    if (query.entityType) {
      sql += ' AND al.entity_type = ?';
      params.push(query.entityType);
    }

    if (query.entityId) {
      sql += ' AND al.entity_id = ?';
      params.push(query.entityId);
    }

    if (query.status) {
      sql += ' AND al.status = ?';
      params.push(query.status);
    }

    if (query.startDate) {
      sql += ' AND al.created_at >= ?';
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ' AND al.created_at <= ?';
      params.push(query.endDate);
    }

    sql += ' ORDER BY al.created_at DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
      
      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }
    }

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params);
    return rows as AuditLogEntry[];
  }

  /**
   * Get login history for a user
   */
  static async getLoginHistory(userId: number, limit: number = 10): Promise<AuditLogEntry[]> {
    return this.getLogs({
      userId,
      action: 'LOGIN',
      limit,
    });
  }

  /**
   * Get failed login attempts for an email (for security monitoring)
   */
  static async getFailedLoginAttempts(
    email: string,
    since: Date
  ): Promise<number> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE action = 'LOGIN_FAILED' 
       AND details->>'$.email' = ?
       AND created_at >= ?`,
      [email, since]
    );
    return rows[0]?.count || 0;
  }

  /**
   * Get recent security events
   */
  static async getSecurityEvents(limit: number = 50): Promise<AuditLogEntry[]> {
    const securityActions: AuditAction[] = [
      'LOGIN_FAILED', 'PASSWORD_RESET', '2FA_ENABLE', '2FA_DISABLE',
      'USER_DEACTIVATE', 'TOKEN_REVOKE', 'SECURITY_EVENT'
    ];

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.action IN (${securityActions.map(() => '?').join(',')})
      ORDER BY al.created_at DESC
      LIMIT ?`,
      [...securityActions, limit]
    );
    return rows as AuditLogEntry[];
  }

  /**
   * Clean up old audit logs (keep last N days)
   */
  static async cleanup(retentionDays: number = 90): Promise<number> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [retentionDays]
    );
    return result.affectedRows;
  }
}

// Helper to extract request info
export function getRequestInfo(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: req.ip || (req.headers?.['x-forwarded-for'] as string) || null,
    userAgent: (req.headers?.['user-agent'] as string) || null,
  };
}

export default AuditLogService;
