import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Record, ParcelStatus, PARCEL_STATUS_FLOW } from '@core/models';
import { ParcelService, NotificationService, SocketService } from '@core/services';
import { ParcelFormDialogComponent } from '../parcel-form-dialog/parcel-form-dialog.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-parcel-log',
  templateUrl: './parcel-log.component.html',
  styleUrls: ['./parcel-log.component.scss']
})
export class ParcelLogComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns: string[] = ['id', 'name', 'resident_name', 'purpose_or_description', 'status', 'created_at', 'actions'];
  dataSource = new MatTableDataSource<Record>([]);
  
  isLoading = true;
  totalRecords = 0;
  pageSize = 10;
  pageIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private parcelService: ParcelService,
    private notification: NotificationService,
    private socketService: SocketService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadParcels();
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadParcels(): void {
    this.isLoading = true;
    this.parcelService.getAll(this.pageIndex + 1, this.pageSize).subscribe({
      next: (response) => {
        this.dataSource.data = response.data;
        this.totalRecords = response.pagination.total;
        this.isLoading = false;
      },
      error: () => {
        this.notification.error('Failed to load parcels');
        this.isLoading = false;
      }
    });
  }

  setupSocketListeners(): void {
    this.socketService.parcelNew$.pipe(takeUntil(this.destroy$)).subscribe(parcel => {
      this.dataSource.data = [parcel, ...this.dataSource.data];
      this.totalRecords++;
    });

    this.socketService.parcelStatusUpdated$.pipe(takeUntil(this.destroy$)).subscribe(updated => {
      const index = this.dataSource.data.findIndex(p => p.id === updated.id);
      if (index !== -1) {
        this.dataSource.data[index] = updated;
        this.dataSource.data = [...this.dataSource.data];
      }
    });
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(ParcelFormDialogComponent, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadParcels();
      }
    });
  }

  updateStatus(parcel: Record, newStatus: ParcelStatus): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Update Status',
        message: `Are you sure you want to change status from ${parcel.status} to ${newStatus}?`,
        confirmText: 'Update',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.parcelService.updateStatus(parcel.id, newStatus).subscribe({
          next: (updated) => {
            const index = this.dataSource.data.findIndex(p => p.id === updated.id);
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

  getNextStatuses(currentStatus: ParcelStatus): ParcelStatus[] {
    return PARCEL_STATUS_FLOW[currentStatus] || [];
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadParcels();
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }
}
