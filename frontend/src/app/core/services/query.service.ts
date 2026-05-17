import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import {
  ResidentQuery,
  CreateQueryRequest,
  UpdateQueryStatusRequest,
  QueryStats,
  QueryStatus,
  QueryPriority,
} from '../models/query.model';
import { ApiResponse } from '../models';

@Injectable({ providedIn: 'root' })
export class QueryService {
  private api = `${environment.apiUrl}/queries`;

  constructor(private http: HttpClient) {}

  // Resident: submit a query
  createQuery(data: CreateQueryRequest): Observable<ResidentQuery> {
    return this.http.post<ApiResponse<ResidentQuery>>(`${this.api}/create`, data).pipe(
      map(r => r.data as ResidentQuery)
    );
  }

  // Resident: get own queries
  getResidentQueries(residentId: number): Observable<ResidentQuery[]> {
    return this.http.get<ApiResponse<ResidentQuery[]>>(`${this.api}/resident/${residentId}`).pipe(
      map(r => r.data as ResidentQuery[])
    );
  }

  // Admin: get all queries with optional filters
  getAllQueries(filters: {
    status?: QueryStatus;
    priority?: QueryPriority;
    search?: string;
  } = {}): Observable<ResidentQuery[]> {
    let params = new HttpParams();
    if (filters.status)   params = params.set('status',   filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.search)   params = params.set('search',   filters.search);

    return this.http.get<ApiResponse<ResidentQuery[]>>(`${this.api}/all`, { params }).pipe(
      map(r => r.data as ResidentQuery[])
    );
  }

  // Admin: get stats
  getQueryStats(): Observable<QueryStats> {
    return this.http.get<ApiResponse<QueryStats>>(`${this.api}/stats`).pipe(
      map(r => r.data as QueryStats)
    );
  }

  // Admin: update status
  updateQueryStatus(id: number, req: UpdateQueryStatusRequest): Observable<ResidentQuery> {
    return this.http.patch<ApiResponse<ResidentQuery>>(`${this.api}/update-status/${id}`, req).pipe(
      map(r => r.data as ResidentQuery)
    );
  }

  // Admin: add remark
  addAdminRemark(id: number, admin_remarks: string): Observable<ResidentQuery> {
    return this.http.patch<ApiResponse<ResidentQuery>>(`${this.api}/remark/${id}`, { admin_remarks }).pipe(
      map(r => r.data as ResidentQuery)
    );
  }

  // Admin: delete query
  deleteQuery(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/delete/${id}`);
  }
}
