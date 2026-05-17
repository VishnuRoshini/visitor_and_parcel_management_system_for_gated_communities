import { Router } from 'express';
import { DashboardController } from '../controllers';
import { authMiddleware, requireAdmin } from '../middlewares/auth';

const router = Router();

// All dashboard routes require admin access
router.use(authMiddleware);
router.use(requireAdmin);

router.get('/stats', DashboardController.getStats);

export default router;
