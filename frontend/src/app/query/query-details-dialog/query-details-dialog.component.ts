import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormControl, Validators } from '@angular/forms';
import { QueryService } from '@core/services/query.service';
import { NotificationService } from '@core/services';
import { ResidentQuery, QueryStatus } from '@core/models/query.model';

export interface QueryDetailsDialogData {
  query: ResidentQuery;
}

@Component({
  selector: 'app-query-details-dialog',
  templateUrl: './query-details-dialog.component.html',
  styleUrls: ['./query-details-dialog.component.scss'],
})
export class QueryDetailsDialogComponent implements OnInit {
  query: ResidentQuery;
  statuses: QueryStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  selectedStatus: QueryStatus;
  remarkControl = new FormControl('', [Validators.minLength(3)]);
  isSavingStatus = false;
  isSavingRemark = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: QueryDetailsDialogData,
    private dialogRef: MatDialogRef<QueryDetailsDialogComponent>,
    private queryService: QueryService,
    private notification: NotificationService
  ) {
    this.query = { ...data.query };
    this.selectedStatus = this.query.status;
  }

  ngOnInit(): void {}

  updateStatus(): void {
    if (this.selectedStatus === this.query.status) {
      this.notification.info('No status change detected.');
      return;
    }
    this.isSavingStatus = true;
    this.queryService.updateQueryStatus(this.query.id, {
      status: this.selectedStatus,
      admin_remarks: this.remarkControl.value?.trim() || undefined,
    }).subscribe({
      next: (updated) => {
        this.query = updated;
        this.notification.success('Status updated successfully.');
        this.isSavingStatus = false;
        this.dialogRef.close('refresh');
      },
      error: () => {
        this.notification.error('Failed to update status.');
        this.isSavingStatus = false;
      },
    });
  }

  saveRemark(): void {
    const remark = this.remarkControl.value?.trim();
    if (!remark) return;

    this.isSavingRemark = true;
    this.queryService.addAdminRemark(this.query.id, remark).subscribe({
      next: (updated) => {
        this.query = updated;
        this.remarkControl.reset();
        this.notification.success('Remark saved. Resident has been notified.');
        this.isSavingRemark = false;
        this.dialogRef.close('refresh');
      },
      error: () => {
        this.notification.error('Failed to save remark.');
        this.isSavingRemark = false;
      },
    });
  }

  getStatusColor(status: string): string {
    const m: Record<string, string> = { PENDING: '#f9a825', IN_PROGRESS: '#1565c0', RESOLVED: '#2e7d32', CLOSED: '#616161' };
    return m[status] || '#9e9e9e';
  }

  getPriorityColor(priority: string): string {
    const m: Record<string, string> = { HIGH: '#c62828', MEDIUM: '#e65100', LOW: '#2e7d32' };
    return m[priority] || '#9e9e9e';
  }

  formatDate(d: Date | string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString();
  }

  close(): void {
    this.dialogRef.close();
  }
}
