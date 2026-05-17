import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import db from '../config/database';

export type QueryStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type QueryPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface ResidentQuery {
  id: number;
  resident_id: number;
  title: string;
  description: string;
  category: string;
  apartment_number: string;
  priority: QueryPriority;
  status: QueryStatus;
  admin_remarks: string | null;
  image_url: string | null;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  // Joined fields
  resident_name?: string;
  resident_email?: string;
}

export interface CreateQueryRequest {
  resident_id: number;
  title: string;
  description: string;
  category: string;
  apartment_number: string;
  priority: QueryPriority;
  image_url?: string;
}

export interface UpdateQueryStatusRequest {
  status: QueryStatus;
  admin_remarks?: string;
}

interface QueryRow extends ResidentQuery, RowDataPacket {}

export class ResidentQueryModel {
  // Create a new query
  static async create(data: CreateQueryRequest): Promise<ResidentQuery> {
    const result = await db.query<ResultSetHeader>(
      `INSERT INTO resident_queries 
       (resident_id, title, description, category, apartment_number, priority, image_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NOW(), NOW())`,
      [
        data.resident_id,
        data.title,
        data.description,
        data.category,
        data.apartment_number,
        data.priority,
        data.image_url || null,
      ]
    );
    const id = (result as any).insertId;
    return this.findById(id) as Promise<ResidentQuery>;
  }

  // Find query by ID with resident details
  static async findById(id: number): Promise<ResidentQuery | null> {
    const rows = await db.query<QueryRow[]>(
      `SELECT rq.*, u.name as resident_name, u.email as resident_email
       FROM resident_queries rq
       JOIN users u ON rq.resident_id = u.id
       WHERE rq.id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // Get all queries for a resident
  static async findByResidentId(residentId: number): Promise<ResidentQuery[]> {
    return db.query<QueryRow[]>(
      `SELECT rq.*, u.name as resident_name, u.email as resident_email
       FROM resident_queries rq
       JOIN users u ON rq.resident_id = u.id
       WHERE rq.resident_id = ?
       ORDER BY rq.created_at DESC`,
      [residentId]
    );
  }

  // Get all queries (admin view)
  static async findAll(filters: {
    status?: QueryStatus;
    priority?: QueryPriority;
    search?: string;
  } = {}): Promise<ResidentQuery[]> {
    let query = `SELECT rq.*, u.name as resident_name, u.email as resident_email
                 FROM resident_queries rq
                 JOIN users u ON rq.resident_id = u.id
                 WHERE 1=1`;
    const params: (string | number)[] = [];

    if (filters.status) {
      query += ' AND rq.status = ?';
      params.push(filters.status);
    }
    if (filters.priority) {
      query += ' AND rq.priority = ?';
      params.push(filters.priority);
    }
    if (filters.search) {
      query += ' AND (rq.title LIKE ? OR rq.description LIKE ? OR u.name LIKE ? OR rq.apartment_number LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s, s);
    }

    query += ' ORDER BY rq.created_at DESC';
    return db.query<QueryRow[]>(query, params);
  }

  // Update query status and optional remarks
  static async updateStatus(
    id: number,
    status: QueryStatus,
    admin_remarks?: string
  ): Promise<ResidentQuery | null> {
    const resolvedAt = status === 'RESOLVED' ? 'NOW()' : 'resolved_at';
    await db.query<ResultSetHeader>(
      `UPDATE resident_queries 
       SET status = ?, admin_remarks = COALESCE(?, admin_remarks), 
           resolved_at = ${status === 'RESOLVED' ? 'NOW()' : 'resolved_at'},
           updated_at = NOW()
       WHERE id = ?`,
      [status, admin_remarks || null, id]
    );
    return this.findById(id);
  }

  // Add admin remarks only
  static async addRemark(id: number, admin_remarks: string): Promise<ResidentQuery | null> {
    await db.query<ResultSetHeader>(
      `UPDATE resident_queries SET admin_remarks = ?, updated_at = NOW() WHERE id = ?`,
      [admin_remarks, id]
    );
    return this.findById(id);
  }

  // Update image URL
  static async updateImageUrl(id: number, image_url: string): Promise<void> {
    await db.query<ResultSetHeader>(
      `UPDATE resident_queries SET image_url = ?, updated_at = NOW() WHERE id = ?`,
      [image_url, id]
    );
  }

  // Delete query
  static async delete(id: number): Promise<boolean> {
    const result = await db.query<ResultSetHeader>(
      `DELETE FROM resident_queries WHERE id = ?`,
      [id]
    );
    return (result as any).affectedRows > 0;
  }

  // Get stats for dashboard
  static async getStats(): Promise<{
    total: number;
    pending: number;
    in_progress: number;
    resolved: number;
    high_priority: number;
  }> {
    const rows = await db.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
         SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
         SUM(CASE WHEN status = 'RESOLVED' THEN 1 ELSE 0 END) as resolved,
         SUM(CASE WHEN priority = 'HIGH' AND status NOT IN ('RESOLVED','CLOSED') THEN 1 ELSE 0 END) as high_priority
       FROM resident_queries`
    );
    const row = rows[0] as any;
    return {
      total: Number(row.total),
      pending: Number(row.pending),
      in_progress: Number(row.in_progress),
      resolved: Number(row.resolved),
      high_priority: Number(row.high_priority),
    };
  }
}
