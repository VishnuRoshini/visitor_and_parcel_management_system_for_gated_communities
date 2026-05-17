import { RecordModel, UserModel } from '../models';
import {
  CreateVisitorRequest,
  VisitorStatus,
  RecordWithDetails,
} from '../types';
import { NotFoundError } from '../utils/errors';

export class VisitorService {
  // Create a new visitor record
  static async createVisitor(
    data: CreateVisitorRequest,
    securityGuardId: number
  ): Promise<RecordWithDetails> {
    // Verify resident exists
    const resident = await UserModel.findById(data.resident_id);
    if (!resident || resident.role !== 'RESIDENT') {
      throw new NotFoundError('Resident not found');
    }

    return RecordModel.createVisitor(data, securityGuardId);
  }

  // Update visitor status
  static async updateStatus(
    id: number,
    status: VisitorStatus
  ): Promise<RecordWithDetails> {
    return RecordModel.updateVisitorStatus(id, status);
  }

  // Get visitor by ID
  static async getById(id: number): Promise<RecordWithDetails> {
    const record = await RecordModel.findByIdWithDetails(id);
    
    if (!record || record.type !== 'VISITOR') {
      throw new NotFoundError('Visitor record not found');
    }
    
    return record;
  }

  // Get all visitors (with optional filtering)
  static async getAll(
    status?: VisitorStatus,
    page: number = 1,
    limit: number = 20
  ) {
    return RecordModel.getAllRecords('VISITOR', status, page, limit);
  }

  // Get visitors for a specific resident
  static async getByResident(
    residentId: number,
    page: number = 1,
    limit: number = 20
  ) {
    return RecordModel.getRecordsByResident(residentId, 'VISITOR', page, limit);
  }

  // Get pending visitors for a resident (needs approval)
  static async getPendingForResident(residentId: number): Promise<RecordWithDetails[]> {
    return RecordModel.getPendingVisitors(residentId);
  }
}

export default VisitorService;
