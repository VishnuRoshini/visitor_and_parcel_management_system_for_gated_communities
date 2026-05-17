// ── Query types added to frontend models ─────────────────────────────────────

export type QueryStatus   = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
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
  created_at: Date | string;
  updated_at: Date | string;
  resolved_at: Date | string | null;
  // Joined fields from backend
  resident_name?: string;
  resident_email?: string;
}

export interface CreateQueryRequest {
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

export interface QueryStats {
  total: number;
  pending: number;
  in_progress: number;
  resolved: number;
  high_priority: number;
}

export const QUERY_CATEGORIES = [
  'Water Leakage',
  'Power Issue',
  'Lift Issue',
  'Cleaning Request',
  'Parking Issue',
  'Internet Issue',
  'Noise Complaint',
  'Plumbing Complaint',
  'Security Concern',
  'Maintenance Request',
  'Other',
];
