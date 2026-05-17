import { Router } from 'express';
import authRoutes from './auth.routes';
import visitorRoutes from './visitor.routes';
import parcelRoutes from './parcel.routes';
import dashboardRoutes from './dashboard.routes';
import queryRoutes from './query.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
router.use('/auth', authRoutes);
router.use('/visitors', visitorRoutes);
router.use('/parcels', parcelRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/queries', queryRoutes);

export default router;
