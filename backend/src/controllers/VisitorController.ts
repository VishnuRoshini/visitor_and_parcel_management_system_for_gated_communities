import { Request, Response, NextFunction } from 'express';
import { VisitorService } from '../services';
import { successResponse, paginatedResponse } from '../utils/helpers';
import { CreateVisitorRequest, VisitorStatus } from '../types';
import { getIO } from '../socket';

export class VisitorController {
  // POST /api/visitors
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: CreateVisitorRequest = req.body;
      const securityGuardId = req.user!.id;

      const visitor = await VisitorService.createVisitor(data, securityGuardId);

      // Emit real-time notification to resident
      const io = getIO();
      io.to(`resident-${data.resident_id}`).emit('visitor:new', visitor);

      res.status(201).json(successResponse(visitor, 'Visitor logged successfully'));
    } catch (error) {
      next(error);
    }
  }

  // PUT /api/visitors/:id/status
  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { status } = req.body as { status: VisitorStatus };

      const visitor = await VisitorService.updateStatus(id, status);

      // Emit real-time notification
      const io = getIO();
      io.to(`resident-${visitor.resident_id}`).emit('visitor:status-updated', visitor);

      res.json(successResponse(visitor, `Visitor status updated to ${status}`));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/visitors/:id
  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const visitor = await VisitorService.getById(id);

      res.json(successResponse(visitor, 'Visitor retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/visitors
  static async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as VisitorStatus | undefined;

      const { records, total } = await VisitorService.getAll(status, page, limit);

      res.json(paginatedResponse(records, page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/visitors/resident/:residentId
  static async getByResident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = parseInt(req.params.residentId, 10);
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const { records, total } = await VisitorService.getByResident(residentId, page, limit);

      res.json(paginatedResponse(records, page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/visitors/resident/:residentId/pending
  static async getPendingForResident(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = parseInt(req.params.residentId, 10);
      const visitors = await VisitorService.getPendingForResident(residentId);

      res.json(successResponse(visitors, 'Pending visitors retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/visitors/my (for current resident user)
  static async getMyVisitors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = req.user!.id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const { records, total } = await VisitorService.getByResident(residentId, page, limit);

      res.json(paginatedResponse(records, page, limit, total));
    } catch (error) {
      next(error);
    }
  }

  // GET /api/visitors/my/pending (for current resident user)
  static async getMyPendingVisitors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const residentId = req.user!.id;
      const visitors = await VisitorService.getPendingForResident(residentId);

      res.json(successResponse(visitors, 'Pending visitors retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export default VisitorController;
