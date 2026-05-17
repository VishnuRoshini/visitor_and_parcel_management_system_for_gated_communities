import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { User } from '@core/models';
import { AuthService, VisitorService, NotificationService } from '@core/services';

@Component({
  selector: 'app-visitor-form-dialog',
  templateUrl: './visitor-form-dialog.component.html',
  styleUrls: ['./visitor-form-dialog.component.scss']
})
export class VisitorFormDialogComponent implements OnInit {
  visitorForm: FormGroup;
  residents: User[] = [];
  isLoading = false;
  isLoadingResidents = true;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<VisitorFormDialogComponent>,
    private authService: AuthService,
    private visitorService: VisitorService,
    private notification: NotificationService
  ) {
    this.visitorForm = this.fb.group({
      resident_id: ['', Validators.required],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      purpose_or_description: ['', Validators.maxLength(500)],
      vehicle_details: ['', Validators.maxLength(100)]
    });
  }

  ngOnInit(): void {
    this.loadResidents();
  }

  loadResidents(): void {
    this.authService.getResidents().subscribe({
      next: (residents) => {
        this.residents = residents;
        this.isLoadingResidents = false;
      },
      error: () => {
        this.notification.error('Failed to load residents');
        this.isLoadingResidents = false;
      }
    });
  }

  onSubmit(): void {
    if (this.visitorForm.invalid) {
      this.visitorForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.visitorService.create(this.visitorForm.value).subscribe({
      next: (visitor) => {
        this.notification.success('Visitor logged successfully');
        this.dialogRef.close(visitor);
      },
      error: (error) => {
        this.notification.error(error.message || 'Failed to log visitor');
        this.isLoading = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(field: string): string {
    const control = this.visitorForm.get(field);
    if (!control) return '';

    if (control.hasError('required')) {
      return 'This field is required';
    }
    if (control.hasError('minlength')) {
      return `Minimum ${control.errors?.['minlength'].requiredLength} characters required`;
    }
    if (control.hasError('maxlength')) {
      return `Maximum ${control.errors?.['maxlength'].requiredLength} characters allowed`;
    }
    return '';
  }
}
