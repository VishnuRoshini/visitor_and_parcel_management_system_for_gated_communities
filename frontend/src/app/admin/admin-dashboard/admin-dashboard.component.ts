import { Component, OnInit } from '@angular/core';
import { DashboardStats, Record } from '@core/models';
import { DashboardService, NotificationService } from '@core/services';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  stats: DashboardStats | null = null;
  isLoading = true;

  displayedColumns = ['id', 'type', 'name', 'resident_name', 'status', 'created_at'];

  constructor(
    private dashboardService: DashboardService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading = true;
    this.dashboardService.getStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        this.isLoading = false;
      },
      error: () => {
        this.notification.error('Failed to load dashboard stats');
        this.isLoading = false;
      }
    });
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }

  getStatusCount(stats: { status: string; count: number }[], status: string): number {
    const found = stats.find(s => s.status === status);
    return found ? found.count : 0;
  }
}
