import { Router } from 'express';
import { VisitorController } from '../controllers';
import { authMiddleware, requireSecurity, requireResident, requireAnyRole } from '../middlewares/auth';
import {
  validate,
  createVisitorValidation,
  updateVisitorStatusValidation,
  idParamValidation,
  paginationValidation,
} from '../middlewares/validation';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Security guard routes - Log visitors
router.post(
  '/',
  requireSecurity,
  validate(createVisitorValidation),
  VisitorController.create
);

// Get all visitors (Security & Admin)
router.get(
  '/',
  requireAnyRole,
  validate(paginationValidation),
  VisitorController.getAll
);

// Resident routes - My visitors
router.get(
  '/my',
  requireResident,
  validate(paginationValidation),
  VisitorController.getMyVisitors
);

router.get(
  '/my/pending',
  requireResident,
  VisitorController.getMyPendingVisitors
);

// Get visitor by ID
router.get(
  '/:id',
  requireAnyRole,
  validate(idParamValidation),
  VisitorController.getById
);

// Update visitor status (any authenticated user based on their role)
router.put(
  '/:id/status',
  requireAnyRole,
  validate(updateVisitorStatusValidation),
  VisitorController.updateStatus
);

// Get visitors by resident ID (Admin & Security can view any, Resident can view their own)
router.get(
  '/resident/:residentId',
  requireAnyRole,
  validate([...idParamValidation, ...paginationValidation]),
  VisitorController.getByResident
);

router.get(
  '/resident/:residentId/pending',
  requireAnyRole,
  validate(idParamValidation),
  VisitorController.getPendingForResident
);

export default router;
