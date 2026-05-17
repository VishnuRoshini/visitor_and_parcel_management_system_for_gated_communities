import { Component, Input } from '@angular/core';
import { RecordStatus } from '@core/models';

@Component({
  selector: 'app-status-badge',
  template: `
    <span class="status-badge" [ngClass]="'status-' + status.toLowerCase()">
      {{ status }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status: RecordStatus = 'NEW';
}
