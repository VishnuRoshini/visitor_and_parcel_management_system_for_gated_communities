import { RecordModel } from '../models';

export class DashboardService {
  static async getStats() {
    return RecordModel.getDashboardStats();
  }
}

export default DashboardService;
