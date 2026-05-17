/**
 * DEPRECATED - This component is replaced by the QueryModule.
 * Kept here only to prevent compilation errors from stale declarations.
 * The actual feature lives in: src/app/query/
 *
 * If this component is declared in app.module.ts, you can safely
 * remove it from there and delete this folder after verifying the build succeeds.
 */
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-resident-query',
  templateUrl: './resident-query.component.html',
  styleUrls: ['./resident-query.component.css']
})
export class ResidentQueryComponent {
  constructor(private router: Router) {
    // Redirect to the new integrated query page
    this.router.navigate(['/query/my-queries']);
  }
}
