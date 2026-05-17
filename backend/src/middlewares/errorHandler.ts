import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { errorResponse } from '../utils/helpers';
import config from '../config';

// Global error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error in development
  if (config.nodeEnv === 'development') {
    console.error('Error:', err);
  }

  // Handle validation errors
  if (err instanceof ValidationError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
    return;
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message));
    return;
  }

  // Handle MySQL errors
  if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
    res.status(409).json(errorResponse('Duplicate entry. This record already exists.'));
    return;
  }

  if ((err as { code?: string }).code === 'ER_NO_REFERENCED_ROW_2') {
    res.status(400).json(errorResponse('Referenced record does not exist.'));
    return;
  }

  // Unknown errors
  res.status(500).json(
    errorResponse(
      config.nodeEnv === 'production' 
        ? 'Internal server error' 
        : err.message
    )
  );
}

// 404 handler
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorResponse(`Route ${req.method} ${req.originalUrl} not found`));
}
