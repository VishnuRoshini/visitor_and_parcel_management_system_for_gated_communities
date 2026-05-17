import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { Record, ParcelStatus, PARCEL_STATUS_FLOW } from '@core/models';
import { ParcelService, NotificationService, SocketService, AuthService } from '@core/services';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-resident-parcel',
  templateUrl: './resident-parcel.component.html',
  styleUrls: ['./resident-parcel.component.scss']
})
export class ResidentParcelComponent implements OnInit, OnDestroy {
  pendingParcels: Record[] = [];
  allParcels: Record[] = [];
  isLoading = true;
  totalRecords = 0;
  pageSize = 10;
  pageIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private parcelService: ParcelService,
    private authService: AuthService,
    private notification: NotificationService,
    private socketService: SocketService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadData();
    this.setupSocketListeners();
    this.joinResidentRoom();
  }

  ngOnDestroy(): void {
    this.leaveResidentRoom();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private joinResidentRoom(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.socketService.connect();
      this.socketService.joinResidentRoom(user.id);
    }
  }

  private leaveResidentRoom(): void {
    const user = this.authService.currentUser;
    if (user) {
      this.socketService.leaveResidentRoom(user.id);
    }
  }

  loadData(): void {
    this.isLoading = true;

    // Load pending parcels
    this.parcelService.getMyPendingParcels().subscribe({
      next: (parcels) => {
        this.pendingParcels = parcels;
      },
      error: () => {
        this.notification.error('Failed to load pending parcels');
      }
    });

    // Load all parcels
    this.parcelService.getMyParcels(this.pageIndex + 1, this.pageSize).subscribe({
      next: (response) => {
        this.allParcels = response.data;
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
      this.pendingParcels = [parcel, ...this.pendingParcels];
      this.allParcels = [parcel, ...this.allParcels];
      this.notification.info(`New parcel from: ${parcel.name}`);
    });

    this.socketService.parcelStatusUpdated$.pipe(takeUntil(this.destroy$)).subscribe(updated => {
      // Update pending list
      if (updated.status === 'COLLECTED') {
        this.pendingParcels = this.pendingParcels.filter(p => p.id !== updated.id);
      } else {
        const pendingIndex = this.pendingParcels.findIndex(p => p.id === updated.id);
        if (pendingIndex !== -1) {
          this.pendingParcels[pendingIndex] = updated;
          this.pendingParcels = [...this.pendingParcels];
        }
      }

      // Update all parcels list
      const index = this.allParcels.findIndex(p => p.id === updated.id);
      if (index !== -1) {
        this.allParcels[index] = updated;
        this.allParcels = [...this.allParcels];
      }
    });
  }

  acknowledgeParcel(parcel: Record): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Acknowledge Parcel',
        message: 'Confirm that you have been notified about this parcel?',
        confirmText: 'Acknowledge',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.parcelService.updateStatus(parcel.id, 'ACKNOWLEDGED').subscribe({
          next: (updated) => {
            const pendingIndex = this.pendingParcels.findIndex(p => p.id === updated.id);
            if (pendingIndex !== -1) {
              this.pendingParcels[pendingIndex] = updated;
              this.pendingParcels = [...this.pendingParcels];
            }
            const index = this.allParcels.findIndex(p => p.id === updated.id);
            if (index !== -1) {
              this.allParcels[index] = updated;
              this.allParcels = [...this.allParcels];
            }
            this.notification.success('Parcel acknowledged');
          },
          error: (error) => {
            this.notification.error(error.message || 'Failed to acknowledge parcel');
          }
        });
      }
    });
  }

  collectParcel(parcel: Record): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Collect Parcel',
        message: 'Confirm that you have collected this parcel?',
        confirmText: 'Collected',
        confirmColor: 'primary'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.parcelService.updateStatus(parcel.id, 'COLLECTED').subscribe({
          next: (updated) => {
            this.pendingParcels = this.pendingParcels.filter(p => p.id !== updated.id);
            const index = this.allParcels.findIndex(p => p.id === updated.id);
            if (index !== -1) {
              this.allParcels[index] = updated;
              this.allParcels = [...this.allParcels];
            }
            this.notification.success('Parcel marked as collected');
          },
          error: (error) => {
            this.notification.error(error.message || 'Failed to collect parcel');
          }
        });
      }
    });
  }

  getNextStatuses(currentStatus: ParcelStatus): ParcelStatus[] {
    return PARCEL_STATUS_FLOW[currentStatus] || [];
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }
}
