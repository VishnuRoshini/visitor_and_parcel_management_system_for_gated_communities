import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Record, VisitorStatus, VISITOR_STATUS_FLOW } from '@core/models';
import { VisitorService, NotificationService, SocketService } from '@core/services';
import { VisitorFormDialogComponent } from '../visitor-form-dialog/visitor-form-dialog.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-visitor-log',
  templateUrl: './visitor-log.component.html',
  styleUrls: ['./visitor-log.component.scss']
})
export class VisitorLogComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  displayedColumns: string[] = ['id', 'name', 'resident_name', 'purpose_or_description', 'vehicle_details', 'status', 'created_at', 'actions'];
  dataSource = new MatTableDataSource<Record>([]);
  
  isLoading = true;
  totalRecords = 0;
  pageSize = 10;
  pageIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private visitorService: VisitorService,
    private notification: NotificationService,
    private socketService: SocketService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadVisitors();
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadVisitors(): void {
    this.isLoading = true;
    this.visitorService.getAll(this.pageIndex + 1, this.pageSize).subscribe({
      next: (response) => {
        this.dataSource.data = response.data;
        this.totalRecords = response.pagination.total;
        this.isLoading = false;
      },
      error: (error) => {
        this.notification.error('Failed to load visitors');
        this.isLoading = false;
      }
    });
  }

  setupSocketListeners(): void {
    this.socketService.visitorNew$.pipe(takeUntil(this.destroy$)).subscribe(visitor => {
      this.dataSource.data = [visitor, ...this.dataSource.data];
      this.totalRecords++;
    });

    this.socketService.visitorStatusUpdated$.pipe(takeUntil(this.destroy$)).subscribe(updated => {
      const index = this.dataSource.data.findIndex(v => v.id === updated.id);
      if (index !== -1) {
        this.dataSource.data[index] = updated;
        this.dataSource.data = [...this.dataSource.data];
      }
    });
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(VisitorFormDialogComponent, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadVisitors();
      }
    });
  }

  updateStatus(visitor: Record, newStatus: VisitorStatus): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Update Status',
        message: `Are you sure you want to change status from ${visitor.status} to ${newStatus}?`,
        confirmText: 'Update',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.visitorService.updateStatus(visitor.id, newStatus).subscribe({
          next: (updated) => {
            const index = this.dataSource.data.findIndex(v => v.id === updated.id);
            if (index !== -1) {
              this.dataSource.data[index] = updated;
              this.dataSource.data = [...this.dataSource.data];
            }
            this.notification.success(`Status updated to ${newStatus}`);
          },
          error: (error) => {
            this.notification.error(error.message || 'Failed to update status');
          }
        });
      }
    });
  }

  getNextStatuses(currentStatus: VisitorStatus): VisitorStatus[] {
    return VISITOR_STATUS_FLOW[currentStatus] || [];
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadVisitors();
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }
}
