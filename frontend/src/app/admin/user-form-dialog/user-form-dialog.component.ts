import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AuthService, NotificationService } from '@core/services';
import { User, UserRole } from '@core/models';

interface DialogData {
  mode: 'create' | 'edit';
  user?: User;
  presetRole?: UserRole | null;
}

@Component({
  selector: 'app-user-form-dialog',
  templateUrl: './user-form-dialog.component.html',
  styleUrls: ['./user-form-dialog.component.scss']
})
export class UserFormDialogComponent implements OnInit {
  form: FormGroup;
  isLoading = false;
  hidePassword = true;
  roles: UserRole[] = ['RESIDENT', 'SECURITY', 'ADMIN'];
  
  // For preset role mode
  presetRole: UserRole | null = null;
  dialogTitle = 'Add User';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private notification: NotificationService,
    private dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.presetRole = data.presetRole || null;
    
    // Set default role based on preset
    const defaultRole = this.presetRole || 'RESIDENT';
    
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', data.mode === 'create' ? [Validators.required, Validators.minLength(6)] : []],
      role: [defaultRole, Validators.required],
      contact_info: ['']
    });
    
    this.updateDialogTitle();
  }

  ngOnInit(): void {
    if (this.data.mode === 'edit' && this.data.user) {
      this.form.patchValue({
        name: this.data.user.name,
        email: this.data.user.email,
        role: this.data.user.role,
        contact_info: this.data.user.contact_info || ''
      });
      // Remove password validation for edit mode
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
      this.updateDialogTitle();
    }
  }

  private updateDialogTitle(): void {
    if (this.data.mode === 'edit') {
      if (this.presetRole === 'RESIDENT') {
        this.dialogTitle = 'Edit Resident';
      } else if (this.presetRole === 'SECURITY') {
        this.dialogTitle = 'Edit Security Guard';
      } else {
        this.dialogTitle = 'Edit User';
      }
    } else {
      if (this.presetRole === 'RESIDENT') {
        this.dialogTitle = 'Add Resident';
      } else if (this.presetRole === 'SECURITY') {
        this.dialogTitle = 'Add Security Guard';
      } else {
        this.dialogTitle = 'Add User';
      }
    }
  }

  get isEditMode(): boolean {
    return this.data.mode === 'edit';
  }

  get showRoleSelector(): boolean {
    // Hide role selector if preset role is set and not in edit mode
    return !this.presetRole;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const formValue = this.form.value;
    
    // Use preset role if available
    if (this.presetRole && this.data.mode === 'create') {
      formValue.role = this.presetRole;
    }

    if (this.isEditMode && this.data.user) {
      // Update user
      const updateData = {
        name: formValue.name,
        email: formValue.email,
        contact_info: formValue.contact_info || null
      };

      this.authService.updateUser(this.data.user.id, updateData).subscribe({
        next: () => {
          this.notification.success('User updated successfully');
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.notification.error(error.error?.message || 'Failed to update user');
          this.isLoading = false;
        }
      });
    } else {
      // Create user
      this.authService.createUser(formValue).subscribe({
        next: () => {
          const roleLabel = formValue.role === 'RESIDENT' ? 'Resident' : formValue.role === 'SECURITY' ? 'Security Guard' : 'User';
          this.notification.success(`${roleLabel} "${formValue.name}" created successfully! They can now login with email: ${formValue.email}`);
          this.dialogRef.close(true);
        },
        error: (error) => {
          this.notification.error(error.error?.message || 'Failed to create user');
          this.isLoading = false;
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
