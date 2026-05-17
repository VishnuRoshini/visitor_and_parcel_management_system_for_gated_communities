import { Component, Input, OnChanges, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { AuthService } from '@core/services';
import { PasswordValidationResponse } from '@core/models';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-password-strength',
  templateUrl: './password-strength.component.html',
  styleUrls: ['./password-strength.component.scss']
})
export class PasswordStrengthComponent implements OnChanges {
  @Input() password: string = '';
  @Output() validationResult = new EventEmitter<PasswordValidationResponse | null>();
  
  validation: PasswordValidationResponse | null = null;
  isValidating = false;
  
  private passwordChanged$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(private authService: AuthService) {
    this.passwordChanged$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(password => {
      this.validatePassword(password);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['password']) {
      const newPassword = changes['password'].currentValue;
      if (newPassword && newPassword.length >= 4) {
        this.passwordChanged$.next(newPassword);
      } else {
        this.validation = null;
        this.validationResult.emit(null);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 4) {
      this.validation = null;
      this.validationResult.emit(null);
      return;
    }

    this.isValidating = true;
    this.authService.validatePassword(password).subscribe({
      next: (result) => {
        this.validation = result;
        this.validationResult.emit(result);
        this.isValidating = false;
      },
      error: () => {
        this.validation = null;
        this.validationResult.emit(null);
        this.isValidating = false;
      }
    });
  }

  getStrengthColor(): string {
    if (!this.validation) return '';
    
    switch (this.validation.label.toUpperCase()) {
      case 'VERY WEAK':
        return 'very-weak';
      case 'WEAK':
        return 'weak';
      case 'FAIR':
        return 'fair';
      case 'STRONG':
        return 'strong';
      case 'VERY STRONG':
        return 'very-strong';
      default:
        return '';
    }
  }

  getStrengthPercentage(): number {
    if (!this.validation) return 0;
    return (this.validation.score / 5) * 100;
  }
}
