import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// =====================================================
// Rate Limiting Configuration
// =====================================================

// General API rate limit - 100 requests per 15 minutes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    retryAfter: 15 * 60, // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests from this IP. Please try again after 15 minutes.',
      retryAfter: 15 * 60,
    });
  },
});

// Login rate limit - 5 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many login attempts from this IP. Account temporarily locked for 15 minutes.',
      retryAfter: 15 * 60,
    });
  },
  // Using default keyGenerator (IP-based) for better security
});

// Password reset rate limit - 10 attempts per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many password reset attempts. Please try again in 1 hour.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many password reset attempts. Please try again in 1 hour.',
      retryAfter: 60 * 60,
    });
  },
});

// OTP verification rate limit - 3 attempts per 5 minutes
export const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: {
    success: false,
    message: 'Too many OTP attempts. Please try again in 5 minutes.',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Too many OTP verification attempts. Please try again in 5 minutes.',
      retryAfter: 5 * 60,
    });
  },
});

// Strict rate limit for sensitive operations - 10 per hour
export const strictLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many requests for this sensitive operation. Please try again later.',
    retryAfter: 60 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'Rate limit exceeded for sensitive operation. Please try again later.',
      retryAfter: 60 * 60,
    });
  },
});

export default {
  generalLimiter,
  loginLimiter,
  passwordResetLimiter,
  otpLimiter,
  strictLimiter,
};
