import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService, NotificationService } from '@core/services';
import { QueryService } from '@core/services/query.service';
import { QUERY_CATEGORIES } from '@core/models/query.model';
import { User } from '@core/models';

@Component({
  selector: 'app-query-form',
  templateUrl: './query-form.component.html',
  styleUrls: ['./query-form.component.scss'],
})
export class QueryFormComponent implements OnInit {
  queryForm!: FormGroup;
  categories = QUERY_CATEGORIES;
  priorities = ['LOW', 'MEDIUM', 'HIGH'];
  isSubmitting = false;
  imagePreview: string | null = null;
  currentUser: User | null = null;

  constructor(
    private fb: FormBuilder,
    private queryService: QueryService,
    private authService: AuthService,
    private notification: NotificationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => (this.currentUser = user));
    this.buildForm();
  }

  private buildForm(): void {
    this.queryForm = this.fb.group({
      title:            ['', [Validators.required, Validators.minLength(5), Validators.maxLength(100)]],
      description:      ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      category:         ['', Validators.required],
      apartment_number: ['', Validators.required],
      priority:         ['MEDIUM', Validators.required],
      image_url:        [''],
    });
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select a valid image file.', 'Close', { duration: 3000 });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.queryForm.patchValue({ image_url: this.imagePreview });
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.imagePreview = null;
    this.queryForm.patchValue({ image_url: '' });
  }

  submitQuery(): void {
    if (this.queryForm.invalid) {
      this.queryForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = { ...this.queryForm.value };
    if (!payload.image_url) delete payload.image_url;

    this.queryService.createQuery(payload).subscribe({
      next: () => {
        this.notification.success('Your query has been submitted successfully! Admin will review it shortly.');
        this.queryForm.reset({ priority: 'MEDIUM' });
        this.imagePreview = null;
        this.isSubmitting = false;
      },
      error: (err) => {
        this.notification.error(err?.error?.message || 'Failed to submit query. Please try again.');
        this.isSubmitting = false;
      },
    });
  }

  getPriorityColor(priority: string): string {
    const map: Record<string, string> = { HIGH: 'warn', MEDIUM: 'accent', LOW: 'primary' };
    return map[priority] || 'primary';
  }
}
