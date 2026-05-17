import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { Record, ApiResponse, PaginatedResponse, CreateParcelRequest, ParcelStatus } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ParcelService {
  private apiUrl = `${environment.apiUrl}/parcels`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private get headers() {
    return this.authService.getAuthHeaders();
  }

  create(data: CreateParcelRequest): Observable<Record> {
    return this.http.post<ApiResponse<Record>>(this.apiUrl, data, { headers: this.headers })
      .pipe(map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to create parcel');
        }
        return response.data;
      }));
  }

  updateStatus(id: number, status: ParcelStatus): Observable<Record> {
    return this.http.put<ApiResponse<Record>>(`${this.apiUrl}/${id}/status`, { status }, { headers: this.headers })
      .pipe(map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to update status');
        }
        return response.data;
      }));
  }

  getById(id: number): Observable<Record> {
    return this.http.get<ApiResponse<Record>>(`${this.apiUrl}/${id}`, { headers: this.headers })
      .pipe(map(response => {
        if (!response.success || !response.data) {
          throw new Error(response.message || 'Parcel not found');
        }
        return response.data;
      }));
  }

  getAll(page: number = 1, limit: number = 20, status?: ParcelStatus): Observable<PaginatedResponse<Record>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    
    if (status) {
      params = params.set('status', status);
    }

    return this.http.get<PaginatedResponse<Record>>(this.apiUrl, { headers: this.headers, params });
  }

  getMyParcels(page: number = 1, limit: number = 20): Observable<PaginatedResponse<Record>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<PaginatedResponse<Record>>(`${this.apiUrl}/my`, { headers: this.headers, params });
  }

  getMyPendingParcels(): Observable<Record[]> {
    return this.http.get<ApiResponse<Record[]>>(`${this.apiUrl}/my/pending`, { headers: this.headers })
      .pipe(map(response => response.data || []));
  }
}
