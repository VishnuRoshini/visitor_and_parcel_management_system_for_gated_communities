import { RowDataPacket } from 'mysql2/promise';
import db from '../config/database';
import config from '../config';
import {
  Record,
  RecordType,
  RecordStatus,
  VisitorStatus,
  ParcelStatus,
  RecordWithDetails,
  CreateVisitorRequest,
  CreateParcelRequest,
} from '../types';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { getTodayDateRange } from '../utils/helpers';

interface RecordRow extends Record, RowDataPacket {}
interface RecordWithDetailsRow extends RecordWithDetails, RowDataPacket {}
interface CountRow extends RowDataPacket {
  count: number;
}
export interface StatusCountRow extends RowDataPacket {
  status: string;
  count: number;
}

export class RecordModel {
  // =====================================================
  // Status Validation
  // =====================================================
  
  private static validateStatusTransition(
    type: RecordType,
    currentStatus: RecordStatus,
    newStatus: RecordStatus
  ): boolean {
    const flow = type === 'VISITOR' 
      ? config.visitorStatusFlow 
      : config.parcelStatusFlow;
    
    const allowedTransitions = flow[currentStatus] || [];
    return allowedTransitions.includes(newStatus);
  }

  // =====================================================
  // Find Methods
  // =====================================================

  static async findById(id: number): Promise<Record | null> {
    const rows = await db.query<RecordRow[]>(
      'SELECT * FROM records WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  static async findByIdWithDetails(id: number): Promise<RecordWithDetails | null> {
    const rows = await db.query<RecordWithDetailsRow[]>(
      `SELECT 
        r.*,
        res.name as resident_name,
        sec.name as guard_name
      FROM records r
      JOIN users res ON r.resident_id = res.id
      JOIN users sec ON r.security_guard_id = sec.id
      WHERE r.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // =====================================================
  // Visitor Methods
  // =====================================================

  static async createVisitor(
    data: CreateVisitorRequest,
    securityGuardId: number
  ): Promise<RecordWithDetails> {
    const result = await db.execute(
      `INSERT INTO records 
        (resident_id, security_guard_id, type, name, purpose_or_description, media_url, vehicle_details, status)
       VALUES (?, ?, 'VISITOR', ?, ?, ?, ?, 'NEW')`,
      [
        data.resident_id,
        securityGuardId,
        data.name,
        data.purpose_or_description || '',
        data.media_url || null,
        data.vehicle_details || null,
      ]
    );

    const record = await this.findByIdWithDetails(result.insertId);
    if (!record) throw new Error('Failed to create visitor record');
    
    return record;
  }

  static async updateVisitorStatus(
    id: number,
    newStatus: VisitorStatus
  ): Promise<RecordWithDetails> {
    const record = await this.findById(id);
    
    if (!record) {
      throw new NotFoundError('Visitor record not found');
    }

    if (record.type !== 'VISITOR') {
      throw new BadRequestError('This is not a visitor record');
    }

    if (!this.validateStatusTransition('VISITOR', record.status, newStatus)) {
      throw new BadRequestError(
        `Invalid status transition. Cannot change from ${record.status} to ${newStatus}. ` +
        `Allowed: ${config.visitorStatusFlow[record.status]?.join(', ') || 'none'}`
      );
    }

    await db.execute(
      'UPDATE records SET status = ? WHERE id = ?',
      [newStatus, id]
    );

    const updated = await this.findByIdWithDetails(id);
    if (!updated) throw new Error('Failed to update visitor');
    
    return updated;
  }

  // =====================================================
  // Parcel Methods
  // =====================================================

  static async createParcel(
    data: CreateParcelRequest,
    securityGuardId: number
  ): Promise<RecordWithDetails> {
    const result = await db.execute(
      `INSERT INTO records 
        (resident_id, security_guard_id, type, name, purpose_or_description, media_url, status)
       VALUES (?, ?, 'PARCEL', ?, ?, ?, 'RECEIVED')`,
      [
        data.resident_id,
        securityGuardId,
        data.name,
        data.purpose_or_description || '',
        data.media_url || null,
      ]
    );

    const record = await this.findByIdWithDetails(result.insertId);
    if (!record) throw new Error('Failed to create parcel record');
    
    return record;
  }

  static async updateParcelStatus(
    id: number,
    newStatus: ParcelStatus
  ): Promise<RecordWithDetails> {
    const record = await this.findById(id);
    
    if (!record) {
      throw new NotFoundError('Parcel record not found');
    }

    if (record.type !== 'PARCEL') {
      throw new BadRequestError('This is not a parcel record');
    }

    if (!this.validateStatusTransition('PARCEL', record.status, newStatus)) {
      throw new BadRequestError(
        `Invalid status transition. Cannot change from ${record.status} to ${newStatus}. ` +
        `Allowed: ${config.parcelStatusFlow[record.status]?.join(', ') || 'none'}`
      );
    }

    await db.execute(
      'UPDATE records SET status = ? WHERE id = ?',
      [newStatus, id]
    );

    const updated = await this.findByIdWithDetails(id);
    if (!updated) throw new Error('Failed to update parcel');
    
    return updated;
  }

  // =====================================================
  // Query Methods
  // =====================================================

  static async getRecordsByResident(
    residentId: number,
    type?: RecordType,
    page: number = 1,
    limit: number = 20
  ): Promise<{ records: RecordWithDetails[]; total: number }> {
    const offset = (page - 1) * limit;
    const whereClause = type 
      ? 'WHERE r.resident_id = ? AND r.type = ?' 
      : 'WHERE r.resident_id = ?';
    const params = type ? [residentId, type] : [residentId];

    // Get total count
    const countResult = await db.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM records r ${whereClause}`,
      params
    );
    const total = countResult[0].count;

    // Get paginated records - use template literal for LIMIT/OFFSET
    const records = await db.query<RecordWithDetailsRow[]>(
      `SELECT 
        r.*,
        res.name as resident_name,
        sec.name as guard_name
      FROM records r
      JOIN users res ON r.resident_id = res.id
      JOIN users sec ON r.security_guard_id = sec.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    return { records, total };
  }

  static async getAllRecords(
    type?: RecordType,
    status?: RecordStatus,
    page: number = 1,
    limit: number = 20
  ): Promise<{ records: RecordWithDetails[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (type) {
      conditions.push('r.type = ?');
      params.push(type);
    }
    if (status) {
      conditions.push('r.status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 
      ? `WHERE ${conditions.join(' AND ')}` 
      : '';

    // Get total count
    const countResult = await db.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM records r ${whereClause}`,
      params
    );
    const total = countResult[0].count;

    // Get paginated records - use template literal for LIMIT/OFFSET to avoid type issues
    const records = await db.query<RecordWithDetailsRow[]>(
      `SELECT 
        r.*,
        res.name as resident_name,
        sec.name as guard_name
      FROM records r
      JOIN users res ON r.resident_id = res.id
      JOIN users sec ON r.security_guard_id = sec.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    return { records, total };
  }

  // Get pending visitors for a resident
  static async getPendingVisitors(residentId: number): Promise<RecordWithDetails[]> {
    return db.query<RecordWithDetailsRow[]>(
      `SELECT 
        r.*,
        res.name as resident_name,
        sec.name as guard_name
      FROM records r
      JOIN users res ON r.resident_id = res.id
      JOIN users sec ON r.security_guard_id = sec.id
      WHERE r.resident_id = ? AND r.type = 'VISITOR' AND r.status IN ('NEW', 'WAITING')
      ORDER BY r.created_at DESC`,
      [residentId]
    );
  }

  // Get pending parcels for a resident
  static async getPendingParcels(residentId: number): Promise<RecordWithDetails[]> {
    return db.query<RecordWithDetailsRow[]>(
      `SELECT 
        r.*,
        res.name as resident_name,
        sec.name as guard_name
      FROM records r
      JOIN users res ON r.resident_id = res.id
      JOIN users sec ON r.security_guard_id = sec.id
      WHERE r.resident_id = ? AND r.type = 'PARCEL' AND r.status IN ('RECEIVED', 'ACKNOWLEDGED')
      ORDER BY r.created_at DESC`,
      [residentId]
    );
  }

  // =====================================================
  // Dashboard Statistics
  // =====================================================

  static async getDashboardStats(): Promise<{
    totalVisitorsToday: number;
    totalParcelsToday: number;
    pendingApprovals: number;
    pendingParcels: number;
    visitorsByStatus: StatusCountRow[];
    parcelsByStatus: StatusCountRow[];
    recentActivity: RecordWithDetails[];
  }> {
    const { start, end } = getTodayDateRange();

    // Today's visitors
    const visitorsToday = await db.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM records 
       WHERE type = 'VISITOR' AND created_at >= ? AND created_at < ?`,
      [start, end]
    );

    // Today's parcels
    const parcelsToday = await db.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM records 
       WHERE type = 'PARCEL' AND created_at >= ? AND created_at < ?`,
      [start, end]
    );

    // Pending visitor approvals
    const pendingApprovals = await db.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM records 
       WHERE type = 'VISITOR' AND status IN ('NEW', 'WAITING')`
    );

    // Pending parcels
    const pendingParcels = await db.query<CountRow[]>(
      `SELECT COUNT(*) as count FROM records 
       WHERE type = 'PARCEL' AND status IN ('RECEIVED', 'ACKNOWLEDGED')`
    );

    // Visitors by status
    const visitorsByStatus = await db.query<StatusCountRow[]>(
      `SELECT status, COUNT(*) as count FROM records 
       WHERE type = 'VISITOR' GROUP BY status`
    );

    // Parcels by status
    const parcelsByStatus = await db.query<StatusCountRow[]>(
      `SELECT status, COUNT(*) as count FROM records 
       WHERE type = 'PARCEL' GROUP BY status`
    );

    // Recent activity (last 10)
    const recentActivity = await db.query<RecordWithDetailsRow[]>(
      `SELECT 
        r.*,
        res.name as resident_name,
        sec.name as guard_name
      FROM records r
      JOIN users res ON r.resident_id = res.id
      JOIN users sec ON r.security_guard_id = sec.id
      ORDER BY r.created_at DESC
      LIMIT 10`
    );

    return {
      totalVisitorsToday: visitorsToday[0].count,
      totalParcelsToday: parcelsToday[0].count,
      pendingApprovals: pendingApprovals[0].count,
      pendingParcels: pendingParcels[0].count,
      visitorsByStatus,
      parcelsByStatus,
      recentActivity,
    };
  }
}

export default RecordModel;
