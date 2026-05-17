import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { User } from '@core/models';
import { AuthService, ParcelService, NotificationService } from '@core/services';

@Component({
  selector: 'app-parcel-form-dialog',
  templateUrl: './parcel-form-dialog.component.html',
  styleUrls: ['./parcel-form-dialog.component.scss']
})
export class ParcelFormDialogComponent implements OnInit {
  parcelForm: FormGroup;
  residents: User[] = [];
  isLoading = false;
  isLoadingResidents = true;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ParcelFormDialogComponent>,
    private authService: AuthService,
    private parcelService: ParcelService,
    private notification: NotificationService
  ) {
    this.parcelForm = this.fb.group({
      resident_id: ['', Validators.required],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      purpose_or_description: ['', Validators.maxLength(500)]
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
    if (this.parcelForm.invalid) {
      this.parcelForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.parcelService.create(this.parcelForm.value).subscribe({
      next: (parcel) => {
        this.notification.success('Parcel logged successfully');
        this.dialogRef.close(parcel);
      },
      error: (error) => {
        this.notification.error(error.message || 'Failed to log parcel');
        this.isLoading = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(field: string): string {
    const control = this.parcelForm.get(field);
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
