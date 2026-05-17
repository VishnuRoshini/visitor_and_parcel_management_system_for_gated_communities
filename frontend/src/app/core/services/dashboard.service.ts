import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { DashboardStats, ApiResponse } from '../models';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private get headers() {
    return this.authService.getAuthHeaders();
  }

  getStats(): Observable<DashboardStats> {
    return this.http.get<ApiResponse<DashboardStats>>(`${this.apiUrl}/stats`, { headers: this.headers })
      .pipe(map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to fetch dashboard stats');
        }
        return response.data;
      }));
  }
}
