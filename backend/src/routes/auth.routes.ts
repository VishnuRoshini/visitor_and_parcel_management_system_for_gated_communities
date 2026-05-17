import { Router } from 'express';
import { AuthController } from '../controllers';
import { authMiddleware, adminOnly } from '../middlewares/auth';
import { loginLimiter, passwordResetLimiter, otpLimiter, strictLimiter } from '../middlewares/rateLimiter';

const router = Router();

// ==========================================
// Public routes (with rate limiting)
// ==========================================
router.post('/login', loginLimiter, AuthController.login);
router.post('/verify-2fa', loginLimiter, AuthController.verify2FA);
router.post('/refresh', AuthController.refreshTokens);
router.post('/validate-password', AuthController.validatePassword);

// OTP routes (rate limited)
router.post('/otp/send', otpLimiter, AuthController.sendOTP);
router.post('/otp/verify', otpLimiter, AuthController.verifyOTP);

// ==========================================
// Protected routes (any authenticated user)
// ==========================================
router.get('/me', authMiddleware, AuthController.getCurrentUser);
router.get('/residents', authMiddleware, AuthController.getResidents);
router.post('/logout', authMiddleware, AuthController.logout);
router.post('/logout-all', authMiddleware, AuthController.logoutAll);

// Password management routes (any authenticated user)
router.post('/setup-password', authMiddleware, passwordResetLimiter, AuthController.setupPassword);
router.post('/change-password', authMiddleware, passwordResetLimiter, AuthController.changePassword);
router.get('/can-change-password', authMiddleware, AuthController.canChangePassword);

// 2FA management routes (any authenticated user)
router.post('/2fa/setup', authMiddleware, strictLimiter, AuthController.setup2FA);
router.post('/2fa/enable', authMiddleware, strictLimiter, AuthController.enable2FA);
router.post('/2fa/disable', authMiddleware, strictLimiter, AuthController.disable2FA);
router.get('/2fa/status', authMiddleware, AuthController.get2FAStatus);

// ==========================================
// Admin only routes - User Management
// ==========================================
router.get('/users', authMiddleware, adminOnly, AuthController.getUsers);
router.post('/users', authMiddleware, adminOnly, AuthController.createUser);
router.put('/users/:id', authMiddleware, adminOnly, AuthController.updateUser);
router.delete('/users/:id', authMiddleware, adminOnly, AuthController.deleteUser);
router.post('/users/:id/reset-password', authMiddleware, adminOnly, passwordResetLimiter, AuthController.resetPassword);
router.post('/users/:id/admin-reset-password', authMiddleware, adminOnly, passwordResetLimiter, AuthController.adminResetPassword);
router.get('/users/:id/has-pin', authMiddleware, adminOnly, AuthController.userHasPin);
router.post('/users/:id/deactivate', authMiddleware, adminOnly, AuthController.deactivateUser);
router.post('/users/:id/activate', authMiddleware, adminOnly, AuthController.activateUser);

// Audit logs (Admin only)
router.get('/audit-logs', authMiddleware, adminOnly, AuthController.getAuditLogs);
router.get('/security-events', authMiddleware, adminOnly, AuthController.getSecurityEvents);

export default router;

