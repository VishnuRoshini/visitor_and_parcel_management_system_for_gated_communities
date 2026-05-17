import { Request, Response, NextFunction } from 'express';
import { UserRole, UserDTO, JwtPayload } from '../types';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { AuthService } from '../services';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: UserDTO;
    }
  }
}

// JWT Authentication Middleware
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required. Please log in.');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new UnauthorizedError('Authentication required. Please log in.');
    }

    // Verify token and extract payload
    const payload: JwtPayload = AuthService.verifyToken(token);
    
    // Set user on request object
    req.user = {
      id: payload.userId,
      name: '', // Will be populated if needed
      email: payload.email,
      role: payload.role,
      contact_info: null,
      is_active: true,
      must_change_password: false, // Will be updated if needed
      password_changed_count: 0, // Will be updated if needed
      can_change_password: true, // Will be computed if needed
      created_at: new Date(),
    };
    
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid authentication.'));
    }
  }
}

// Role-based access control middleware factory
export function roleGuard(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required.');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(
        `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.user.role}`
      );
    }

    next();
  };
}

// Specific role guards for convenience
export const adminOnly = roleGuard('ADMIN');
export const securityOnly = roleGuard('SECURITY');
export const residentOnly = roleGuard('RESIDENT');
export const securityOrAdmin = roleGuard('SECURITY', 'ADMIN');
export const residentOrSecurity = roleGuard('RESIDENT', 'SECURITY');
export const requireAdmin = roleGuard('ADMIN');
export const requireSecurity = roleGuard('SECURITY');
export const requireResident = roleGuard('RESIDENT');
export const requireSecurityOrAdmin = roleGuard('SECURITY', 'ADMIN');
export const requireResidentOrAdmin = roleGuard('RESIDENT', 'ADMIN');
export const requireAnyRole = roleGuard('RESIDENT', 'SECURITY', 'ADMIN');
