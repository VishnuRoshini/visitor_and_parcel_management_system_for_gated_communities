import { Router } from 'express';
import { authMiddleware, adminOnly, residentOnly, requireResidentOrAdmin } from '../middlewares/auth';
import {
  createQuery,
  getResidentQueries,
  getAllQueries,
  updateQueryStatus,
  addAdminRemark,
  deleteQuery,
  getQueryStats,
} from '../controllers/QueryController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// ── Resident routes ───────────────────────────────────────────────────────────
// POST /api/queries/create  — resident submits query
router.post('/create', residentOnly, createQuery);

// GET  /api/queries/resident/:id  — resident views own queries
router.get('/resident/:id', requireResidentOrAdmin, getResidentQueries);

// ── Admin routes ──────────────────────────────────────────────────────────────
// GET  /api/queries/all  — admin views all queries
router.get('/all', adminOnly, getAllQueries);

// GET  /api/queries/stats  — admin dashboard widget stats
router.get('/stats', adminOnly, getQueryStats);

// PATCH /api/queries/update-status/:id  — admin updates status
router.patch('/update-status/:id', adminOnly, updateQueryStatus);

// PATCH /api/queries/remark/:id  — admin adds remark
router.patch('/remark/:id', adminOnly, addAdminRemark);

// DELETE /api/queries/delete/:id  — admin deletes invalid query
router.delete('/delete/:id', adminOnly, deleteQuery);

export default router;
