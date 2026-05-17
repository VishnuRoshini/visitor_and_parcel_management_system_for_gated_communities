import { RecordModel, UserModel } from '../models';
import {
  CreateParcelRequest,
  ParcelStatus,
  RecordWithDetails,
} from '../types';
import { NotFoundError } from '../utils/errors';

export class ParcelService {
  // Create a new parcel record
  static async createParcel(
    data: CreateParcelRequest,
    securityGuardId: number
  ): Promise<RecordWithDetails> {
    // Verify resident exists
    const resident = await UserModel.findById(data.resident_id);
    if (!resident || resident.role !== 'RESIDENT') {
      throw new NotFoundError('Resident not found');
    }

    return RecordModel.createParcel(data, securityGuardId);
  }

  // Update parcel status
  static async updateStatus(
    id: number,
    status: ParcelStatus
  ): Promise<RecordWithDetails> {
    return RecordModel.updateParcelStatus(id, status);
  }

  // Get parcel by ID
  static async getById(id: number): Promise<RecordWithDetails> {
    const record = await RecordModel.findByIdWithDetails(id);
    
    if (!record || record.type !== 'PARCEL') {
      throw new NotFoundError('Parcel record not found');
    }
    
    return record;
  }

  // Get all parcels (with optional filtering)
  static async getAll(
    status?: ParcelStatus,
    page: number = 1,
    limit: number = 20
  ) {
    return RecordModel.getAllRecords('PARCEL', status, page, limit);
  }

  // Get parcels for a specific resident
  static async getByResident(
    residentId: number,
    page: number = 1,
    limit: number = 20
  ) {
    return RecordModel.getRecordsByResident(residentId, 'PARCEL', page, limit);
  }

  // Get pending parcels for a resident
  static async getPendingForResident(residentId: number): Promise<RecordWithDetails[]> {
    return RecordModel.getPendingParcels(residentId);
  }
}

export default ParcelService;
