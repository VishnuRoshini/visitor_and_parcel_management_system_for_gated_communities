import { Router } from 'express';
import { ParcelController } from '../controllers';
import { authMiddleware, requireSecurity, requireResident, requireAnyRole } from '../middlewares/auth';
import {
  validate,
  createParcelValidation,
  updateParcelStatusValidation,
  idParamValidation,
  paginationValidation,
} from '../middlewares/validation';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Security guard routes - Log parcels
router.post(
  '/',
  requireSecurity,
  validate(createParcelValidation),
  ParcelController.create
);

// Get all parcels (Security & Admin)
router.get(
  '/',
  requireAnyRole,
  validate(paginationValidation),
  ParcelController.getAll
);

// Resident routes - My parcels
router.get(
  '/my',
  requireResident,
  validate(paginationValidation),
  ParcelController.getMyParcels
);

router.get(
  '/my/pending',
  requireResident,
  ParcelController.getMyPendingParcels
);

// Get parcel by ID
router.get(
  '/:id',
  requireAnyRole,
  validate(idParamValidation),
  ParcelController.getById
);

// Update parcel status
router.put(
  '/:id/status',
  requireAnyRole,
  validate(updateParcelStatusValidation),
  ParcelController.updateStatus
);

// Get parcels by resident ID
router.get(
  '/resident/:residentId',
  requireAnyRole,
  validate([...idParamValidation, ...paginationValidation]),
  ParcelController.getByResident
);

router.get(
  '/resident/:residentId/pending',
  requireAnyRole,
  validate(idParamValidation),
  ParcelController.getPendingForResident
);

export default router;
