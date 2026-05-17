import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { AuthService, NotificationService } from '@core/services';
import { User, UserRole } from '@core/models';
import { UserFormDialogComponent } from '../user-form-dialog/user-form-dialog.component';
import { ResetPasswordDialogComponent } from '../reset-password-dialog/reset-password-dialog.component';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
  displayedColumns: string[] = ['id', 'name', 'email', 'role', 'contact_info', 'is_active', 'actions'];
  dataSource = new MatTableDataSource<User>([]);
  isLoading = false;
  
  // Role filtering
  filterRole: UserRole | null = null;
  pageTitle = 'User Management';
  pageDescription = 'Manage system users - residents, security guards, and admins';
  addButtonText = 'Add User';

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  roleColors: Record<UserRole, string> = {
    'ADMIN': 'warn',
    'SECURITY': 'accent',
    'RESIDENT': 'primary'
  };

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private notification: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    // Check if we have a role filter from route data
    this.route.data.subscribe(data => {
      this.filterRole = data['filterRole'] || null;
      this.updatePageInfo();
      this.loadUsers();
    });
  }

  private updatePageInfo(): void {
    if (this.filterRole === 'RESIDENT') {
      this.pageTitle = 'Manage Residents';
      this.pageDescription = 'Add, edit, or remove residents from the system';
      this.addButtonText = 'Add Resident';
      // Hide role column for filtered views
      this.displayedColumns = ['id', 'name', 'email', 'contact_info', 'is_active', 'actions'];
    } else if (this.filterRole === 'SECURITY') {
      this.pageTitle = 'Manage Security Guards';
      this.pageDescription = 'Add, edit, or remove security guards from the system';
      this.addButtonText = 'Add Guard';
      this.displayedColumns = ['id', 'name', 'email', 'contact_info', 'is_active', 'actions'];
    } else {
      this.pageTitle = 'User Management';
      this.pageDescription = 'Manage system users - residents, security guards, and admins';
      this.addButtonText = 'Add User';
      this.displayedColumns = ['id', 'name', 'email', 'role', 'contact_info', 'is_active', 'actions'];
    }
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  loadUsers(): void {
    this.isLoading = true;
    this.authService.getAllUsers().subscribe({
      next: (users) => {
        // Filter users by role if filterRole is set
        if (this.filterRole) {
          this.dataSource.data = users.filter(u => u.role === this.filterRole);
        } else {
          this.dataSource.data = users;
        }
        this.isLoading = false;
      },
      error: (error) => {
        this.notification.error(error.message || 'Failed to load users');
        this.isLoading = false;
      }
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, {
      width: '500px',
      data: { mode: 'create', presetRole: this.filterRole }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  openEditDialog(user: User): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, {
      width: '500px',
      data: { mode: 'edit', user, presetRole: this.filterRole }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadUsers();
      }
    });
  }

  openResetPasswordDialog(user: User): void {
    const dialogRef = this.dialog.open(ResetPasswordDialogComponent, {
      width: '450px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Success notification is handled in the dialog
      }
    });
  }

  toggleUserStatus(user: User): void {
    const action = user.is_active ? 'deactivate' : 'activate';
    const actionFn = user.is_active 
      ? this.authService.deactivateUser(user.id)
      : this.authService.activateUser(user.id);

    actionFn.subscribe({
      next: () => {
        this.notification.success(`User ${action}d successfully`);
        this.loadUsers();
      },
      error: (error) => {
        this.notification.error(error.message || `Failed to ${action} user`);
      }
    });
  }

  deleteUser(user: User): void {
    if (confirm(`Are you sure you want to permanently remove ${user.name}? This action cannot be undone.`)) {
      // For now, we'll just deactivate. If you want actual deletion, add a delete endpoint
      this.authService.deactivateUser(user.id).subscribe({
        next: () => {
          this.notification.success(`${user.name} has been removed`);
          this.loadUsers();
        },
        error: (error) => {
          this.notification.error(error.message || 'Failed to remove user');
        }
      });
    }
  }
}
