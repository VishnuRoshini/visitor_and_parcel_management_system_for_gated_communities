import { ApiResponse, PaginatedResponse } from '../types';

// Success response helper
export function successResponse<T>(data: T, message: string = 'Success'): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
  };
}

// Error response helper
export function errorResponse(message: string, error?: string): ApiResponse {
  return {
    success: false,
    message,
    error,
  };
}

// Paginated response helper
export function paginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// Date formatter for MySQL
export function formatDateForMySQL(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Get today's date range for queries
export function getTodayDateRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  return {
    start: formatDateForMySQL(start),
    end: formatDateForMySQL(end),
  };
}

// Sanitize user object (remove password)
export function sanitizeUser<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password, ...sanitized } = user;
  return sanitized;
}
