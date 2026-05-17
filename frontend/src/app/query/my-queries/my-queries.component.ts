import { Component } from '@angular/core';

@Component({
  selector: 'app-my-queries',
  template: `
    <div class="my-queries-page">
      <mat-tab-group animationDuration="200ms">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>add_circle_outline</mat-icon>&nbsp;Submit Query
          </ng-template>
          <app-query-form></app-query-form>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>history</mat-icon>&nbsp;My History
          </ng-template>
          <app-query-history></app-query-history>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`.my-queries-page { padding: 0; }`],
})
export class MyQueriesComponent {}
