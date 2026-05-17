import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, SocketService, NotificationService } from '@core/services';
import { QueryService } from '@core/services/query.service';
import { ResidentQuery } from '@core/models/query.model';
import { User } from '@core/models';

@Component({
  selector: 'app-query-history',
  templateUrl: './query-history.component.html',
  styleUrls: ['./query-history.component.scss'],
})
export class QueryHistoryComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  queries: ResidentQuery[] = [];
  isLoading = true;
  currentUser: User | null = null;
  expandedQueryId: number | null = null;

  displayedColumns = ['title', 'category', 'priority', 'status', 'created_at', 'actions'];

  constructor(
    private queryService: QueryService,
    private authService: AuthService,
    private socketService: SocketService,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.currentUser = user;
      if (user) this.loadQueries(user.id);
    });

    this.listenToSocket();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQueries(residentId: number): void {
    this.isLoading = true;
    this.queryService.getResidentQueries(residentId).subscribe({
      next: (queries) => {
        this.queries = queries;
        this.isLoading = false;
      },
      error: () => {
        this.notification.error('Failed to load your queries.');
        this.isLoading = false;
      },
    });
  }

  private listenToSocket(): void {
    // Listen for real-time status updates via SocketService
    const socket = (this.socketService as any).socket;
    if (!socket) return;

    socket.on('query:status-updated', (updated: ResidentQuery) => {
      this.updateQueryInList(updated);
    });

    socket.on('query:resolved', (payload: { query: ResidentQuery; message: string }) => {
      this.updateQueryInList(payload.query);
      this.notification.success(payload.message);
    });

    socket.on('query:remark-added', (updated: ResidentQuery) => {
      this.updateQueryInList(updated);
      this.notification.info('Admin added a remark to your query.');
    });
  }

  private updateQueryInList(updated: ResidentQuery): void {
    const idx = this.queries.findIndex(q => q.id === updated.id);
    if (idx !== -1) this.queries[idx] = updated;
  }

  toggleExpand(id: number): void {
    this.expandedQueryId = this.expandedQueryId === id ? null : id;
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      PENDING:     '#f9a825',
      IN_PROGRESS: '#1565c0',
      RESOLVED:    '#2e7d32',
      CLOSED:      '#616161',
    };
    return map[status] || '#9e9e9e';
  }

  getPriorityColor(priority: string): string {
    const map: Record<string, string> = {
      HIGH:   '#c62828',
      MEDIUM: '#e65100',
      LOW:    '#2e7d32',
    };
    return map[priority] || '#9e9e9e';
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }
}
