import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services';
import { successResponse } from '../utils/helpers';

export class DashboardController {
  // GET /api/dashboard/stats
  static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await DashboardService.getStats();
      res.json(successResponse(stats, 'Dashboard stats retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }
}

export default DashboardController;
