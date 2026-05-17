import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { Record, VisitorStatus, VISITOR_STATUS_FLOW } from '@core/models';
import { VisitorService, NotificationService, SocketService, AuthService } from '@core/services';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-resident-approval',
  templateUrl: './resident-approval.component.html',
  styleUrls: ['./resident-approval.component.scss']
})
export class ResidentApprovalComponent implements OnInit, OnDestroy {
  pendingVisitors: Record[] = [];
  allVisitors: Record[] = [];
  isLoading = true;
  activeTab = 'pending';
  totalRecords = 0;
  pageSize = 10;
  pageIndex = 0;

  private destroy$ = new Subject<void>();

  constructor(
    private visitorService: VisitorService,
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
    
    // Load pending visitors
    this.visitorService.getMyPendingVisitors().subscribe({
      next: (visitors) => {
        this.pendingVisitors = visitors;
      },
      error: () => {
        this.notification.error('Failed to load pending visitors');
      }
    });

    // Load all visitors
    this.visitorService.getMyVisitors(this.pageIndex + 1, this.pageSize).subscribe({
      next: (response) => {
        this.allVisitors = response.data;
        this.totalRecords = response.pagination.total;
        this.isLoading = false;
      },
      error: () => {
        this.notification.error('Failed to load visitors');
        this.isLoading = false;
      }
    });
  }

  setupSocketListeners(): void {
    this.socketService.visitorNew$.pipe(takeUntil(this.destroy$)).subscribe(visitor => {
      this.pendingVisitors = [visitor, ...this.pendingVisitors];
      this.allVisitors = [visitor, ...this.allVisitors];
      this.notification.info(`New visitor: ${visitor.name}`);
    });

    this.socketService.visitorStatusUpdated$.pipe(takeUntil(this.destroy$)).subscribe(updated => {
      // Update in pending list
      if (['APPROVED', 'REJECTED', 'ENTERED', 'EXITED'].includes(updated.status)) {
        this.pendingVisitors = this.pendingVisitors.filter(v => v.id !== updated.id);
      }

      // Update in all visitors list
      const index = this.allVisitors.findIndex(v => v.id === updated.id);
      if (index !== -1) {
        this.allVisitors[index] = updated;
        this.allVisitors = [...this.allVisitors];
      }
    });
  }

  approveVisitor(visitor: Record): void {
    this.updateStatus(visitor, 'APPROVED', 'Approve Visitor', 'Are you sure you want to approve this visitor?');
  }

  rejectVisitor(visitor: Record): void {
    this.updateStatus(visitor, 'REJECTED', 'Reject Visitor', 'Are you sure you want to reject this visitor?', 'warn');
  }

  private updateStatus(visitor: Record, status: VisitorStatus, title: string, message: string, color: 'primary' | 'warn' = 'primary'): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: { title, message, confirmText: status, confirmColor: color }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.visitorService.updateStatus(visitor.id, status).subscribe({
          next: (updated) => {
            this.pendingVisitors = this.pendingVisitors.filter(v => v.id !== updated.id);
            const index = this.allVisitors.findIndex(v => v.id === updated.id);
            if (index !== -1) {
              this.allVisitors[index] = updated;
              this.allVisitors = [...this.allVisitors];
            }
            this.notification.success(`Visitor ${status.toLowerCase()}`);
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

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleString();
  }

  onTabChange(tab: string): void {
    this.activeTab = tab;
  }
}
