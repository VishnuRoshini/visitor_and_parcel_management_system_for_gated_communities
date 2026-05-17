import { Request, Response, NextFunction } from 'express';
import { ParcelService } from '../services';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { CreateParcelRequest, ParcelStatus } from '../types';
import { getIO } from '../socket';

export class ParcelController {
  // POST /api/parcels
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateParcelRequest = req.body;
      const securityGuardId = req.user!.id;

      const parcel = await ParcelService.createParcel(data, securityGuardId);

      // Emit real-time notification to resident
      const io = getIO();
      io.to(`resident-${data.resident_id}`).emit('parcel:new', parcel);

      res.status(201).json(successResponse(parcel, 'Parcel logged successfully'));
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/parcels/:id/status
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body as { status: ParcelStatus };

      const parcel = await ParcelService.updateStatus(id, status);

      // Emit real-time notification
      const io = getIO();
      io.to(`resident-${parcel.resident_id}`).emit('parcel:status-updated', parcel);

      res.json(successResponse(parcel, `Parcel status updated to ${status}`));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/parcels/:id
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const parcel = await ParcelService.getById(id);

      res.json(successResponse(parcel, 'Parcel retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/parcels
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as ParcelStatus | undefined;

      const { records, total } = await ParcelService.getAll(status, page, limit);

      res.json(paginatedResponse(records, page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/parcels/resident/:residentId
  static async getByResident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = parseInt(req.params.residentId, 10);
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const { records, total } = await ParcelService.getByResident(residentId, page, limit);

      res.json(paginatedResponse(records, page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/parcels/resident/:residentId/pending
  static async getPendingForResident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = parseInt(req.params.residentId, 10);
      const parcels = await ParcelService.getPendingForResident(residentId);

      res.json(successResponse(parcels, 'Pending parcels retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/parcels/my (for current resident user)
  static async getMyParcels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = req.user!.id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const { records, total } = await ParcelService.getByResident(residentId, page, limit);

      res.json(paginatedResponse(records, page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/parcels/my/pending (for current resident user)
  static async getMyPendingParcels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = req.user!.id;
      const parcels = await ParcelService.getPendingForResident(residentId);

      res.json(successResponse(parcels, 'Pending parcels retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export default ParcelController;
