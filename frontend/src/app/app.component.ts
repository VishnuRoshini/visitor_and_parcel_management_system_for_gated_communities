import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject, filter, takeUntil } from 'rxjs';
import { User, UserRole } from '@core/models';
import { AuthService, SocketService, NotificationService } from '@core/services';
import { ChangePasswordDialogComponent } from './auth/change-password-dialog/change-password-dialog.component';
import { PasswordSetupDialogComponent } from './auth/password-setup-dialog/password-setup-dialog.component';
import { TwoFactorSettingsDialogComponent } from './auth/two-factor-settings-dialog/two-factor-settings-dialog.component';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  isLoggedIn = false;
  isSidebarOpen = true;
  pageTitle = 'Dashboard';

  navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard', roles: ['ADMIN'] },
    { label: 'Visitor Log', icon: 'people', route: '/visitor/log', roles: ['SECURITY', 'ADMIN'] },
    { label: 'Parcel Log', icon: 'inventory_2', route: '/parcel/log', roles: ['SECURITY', 'ADMIN'] },
    { label: 'Visitor Approvals', icon: 'how_to_reg', route: '/visitor/approvals', roles: ['RESIDENT'] },
    { label: 'My Parcels', icon: 'markunread_mailbox', route: '/parcel/tracking', roles: ['RESIDENT'] },
    { label: 'My Queries', icon: 'report_problem', route: '/query/my-queries', roles: ['RESIDENT'] },
    { label: 'Resident Queries', icon: 'contact_support', route: '/query/admin-queries', roles: ['ADMIN'] },
  ];

  constructor(
    private authService: AuthService,
    private socketService: SocketService,
    private router: Router,
    private dialog: MatDialog,
    private notification: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(user => {
      this.currentUser = user;
      this.isLoggedIn = !!user;
      
      if (user) {
        this.socketService.connect();
        this.socketService.joinResidentRoom(user.id);
      } else {
        this.socketService.disconnect();
      }
    });

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.updatePageTitle();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.socketService.disconnect();
  }

  get filteredNavItems(): NavItem[] {
    if (!this.currentUser) return [];
    return this.navItems.filter(item => 
      item.roles.includes(this.currentUser!.role)
    );
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  openChangePasswordDialog(): void {
    // Password setup on first login is now disabled
    const dialogRef = this.dialog.open(ChangePasswordDialogComponent, {
      width: '500px'
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.notification.success('Password changed successfully!');
      }
    });
  }

  open2FASettingsDialog(): void {
    this.dialog.open(TwoFactorSettingsDialogComponent, {
      width: '500px'
    });
  }

  logoutAllSessions(): void {
    this.authService.logoutAll().subscribe({
      next: () => {
        this.notification.success('Logged out from all sessions');
        this.router.navigate(['/login']);
      },
      error: (error) => {
        this.notification.error(error.message || 'Failed to logout from all sessions');
      }
    });
  }

  private updatePageTitle(): void {
    const currentRoute = this.router.url;
    const navItem = this.navItems.find(item => currentRoute.includes(item.route));
    this.pageTitle = navItem?.label || 'Dashboard';
  }

  getRoleBadgeClass(): string {
    switch (this.currentUser?.role) {
      case 'ADMIN': return 'role-admin';
      case 'SECURITY': return 'role-security';
      case 'RESIDENT': return 'role-resident';
      default: return '';
    }
  }
}
