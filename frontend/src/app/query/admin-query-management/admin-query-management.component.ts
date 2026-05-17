import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { FormControl } from '@angular/forms';
import { QueryService } from '@core/services/query.service';
import { SocketService, NotificationService } from '@core/services';
import { ResidentQuery, QueryStatus, QueryPriority, QueryStats } from '@core/models/query.model';
import { QueryDetailsDialogComponent } from '../query-details-dialog/query-details-dialog.component';

@Component({
  selector: 'app-admin-query-management',
  templateUrl: './admin-query-management.component.html',
  styleUrls: ['./admin-query-management.component.scss'],
})
export class AdminQueryManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  dataSource = new MatTableDataSource<ResidentQuery>();
  displayedColumns = ['resident_name', 'title', 'category', 'apartment_number', 'priority', 'status', 'created_at', 'actions'];

  searchControl = new FormControl('');
  statusFilter: QueryStatus | '' = '';
  priorityFilter: QueryPriority | '' = '';

  stats: QueryStats = { total: 0, pending: 0, in_progress: 0, resolved: 0, high_priority: 0 };
  isLoading = true;

  statuses: QueryStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  priorities: QueryPriority[] = ['LOW', 'MEDIUM', 'HIGH'];

  constructor(
    private queryService: QueryService,
    private socketService: SocketService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.loadStats();
    this.setupSearch();
    this.listenToSocket();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAll(): void {
    this.isLoading = true;
    this.queryService.getAllQueries({
      status:   this.statusFilter   || undefined,
      priority: this.priorityFilter || undefined,
      search:   this.searchControl.value?.trim() || undefined,
    }).subscribe({
      next: (queries) => {
        this.dataSource.data = queries;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        this.isLoading = false;
      },
      error: () => {
        this.notification.error('Failed to load queries.');
        this.isLoading = false;
      },
    });
  }

  loadStats(): void {
    this.queryService.getQueryStats().subscribe({
      next: (s) => (this.stats = s),
      error: () => {},
    });
  }

  private setupSearch(): void {
    this.searchControl.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => this.loadAll());
  }

  private listenToSocket(): void {
    const socket = (this.socketService as any).socket;
    if (!socket) return;

    socket.on('query:new', (q: ResidentQuery) => {
      this.dataSource.data = [q, ...this.dataSource.data];
      this.stats.total++;
      this.stats.pending++;
      if (q.priority === 'HIGH') this.stats.high_priority++;
      this.notification.info(`New query submitted by ${q.resident_name}: "${q.title}"`);
    });

    socket.on('query:resolved-ack', (_q: ResidentQuery) => {
      this.loadStats();
    });
  }

  openDetails(query: ResidentQuery): void {
    const ref = this.dialog.open(QueryDetailsDialogComponent, {
      width: '600px',
      data: { query },
    });
    ref.afterClosed().subscribe((result) => {
      if (result === 'refresh') {
        this.loadAll();
        this.loadStats();
      }
    });
  }

  quickUpdateStatus(id: number, status: QueryStatus): void {
    this.queryService.updateQueryStatus(id, { status }).subscribe({
      next: (updated) => {
        this.updateRow(updated);
        this.loadStats();
        this.notification.success(`Query marked as ${status}.`);
      },
      error: () => this.notification.error('Failed to update status.'),
    });
  }

  deleteQuery(id: number): void {
    if (!confirm('Delete this query? This cannot be undone.')) return;
    this.queryService.deleteQuery(id).subscribe({
      next: () => {
        this.dataSource.data = this.dataSource.data.filter(q => q.id !== id);
        this.loadStats();
        this.notification.success('Query deleted.');
      },
      error: () => this.notification.error('Failed to delete query.'),
    });
  }

  private updateRow(updated: ResidentQuery): void {
    const idx = this.dataSource.data.findIndex(q => q.id === updated.id);
    if (idx !== -1) {
      const data = [...this.dataSource.data];
      data[idx] = updated;
      this.dataSource.data = data;
    }
  }

  applyFilters(): void { this.loadAll(); }

  clearFilters(): void {
    this.statusFilter = '';
    this.priorityFilter = '';
    this.searchControl.setValue('');
    this.loadAll();
  }

  getStatusColor(status: string): string {
    const m: Record<string, string> = { PENDING: '#f9a825', IN_PROGRESS: '#1565c0', RESOLVED: '#2e7d32', CLOSED: '#616161' };
    return m[status] || '#9e9e9e';
  }

  getPriorityColor(priority: string): string {
    const m: Record<string, string> = { HIGH: '#c62828', MEDIUM: '#e65100', LOW: '#2e7d32' };
    return m[priority] || '#9e9e9e';
  }

  formatDate(d: Date | string): string {
    return new Date(d).toLocaleDateString();
  }
}
