import { Request, Response, NextFunction } from 'express';
import { ResidentQueryModel, QueryStatus, QueryPriority } from '../models/ResidentQueryModel';
import { getIO } from '../socket';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/errors';

// ── Resident: Submit a new query ─────────────────────────────────────────────
export async function createQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, description, category, apartment_number, priority, image_url } = req.body;
    const resident_id = req.user!.id;

    if (!title || !description || !category || !apartment_number || !priority) {
      throw new BadRequestError('title, description, category, apartment_number and priority are required.');
    }

    const validPriorities: QueryPriority[] = ['LOW', 'MEDIUM', 'HIGH'];
    if (!validPriorities.includes(priority)) {
      throw new BadRequestError('priority must be LOW, MEDIUM or HIGH.');
    }

    const query = await ResidentQueryModel.create({
      resident_id,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      apartment_number: apartment_number.trim(),
      priority,
      image_url: image_url || undefined,
    });

    // Emit socket events
    try {
      const io = getIO();
      // Notify all admins
      io.emit('query:new', query);
      // Alert for high priority
      if (priority === 'HIGH') {
        io.emit('query:high-priority', query);
      }
    } catch (_) { /* socket not critical */ }

    res.status(201).json({ success: true, message: 'Query submitted successfully.', data: query });
  } catch (error) {
    next(error);
  }
}

// ── Resident: Get own queries ─────────────────────────────────────────────────
export async function getResidentQueries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const residentId = parseInt(req.params.id, 10);

    // Residents can only see their own queries
    if (req.user!.role === 'RESIDENT' && req.user!.id !== residentId) {
      throw new ForbiddenError('You can only view your own queries.');
    }

    const queries = await ResidentQueryModel.findByResidentId(residentId);
    res.json({ success: true, message: 'Queries fetched.', data: queries });
  } catch (error) {
    next(error);
  }
}

// ── Admin: Get all queries ────────────────────────────────────────────────────
export async function getAllQueries(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, priority, search } = req.query as {
      status?: QueryStatus;
      priority?: QueryPriority;
      search?: string;
    };

    const queries = await ResidentQueryModel.findAll({ status, priority, search });
    res.json({ success: true, message: 'All queries fetched.', data: queries });
  } catch (error) {
    next(error);
  }
}

// ── Admin: Update query status ────────────────────────────────────────────────
export async function updateQueryStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, admin_remarks } = req.body;

    const validStatuses: QueryStatus[] = ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!status || !validStatuses.includes(status)) {
      throw new BadRequestError('Valid status is required: PENDING, IN_PROGRESS, RESOLVED or CLOSED.');
    }

    const existing = await ResidentQueryModel.findById(id);
    if (!existing) throw new NotFoundError('Query not found.');

    const updated = await ResidentQueryModel.updateStatus(id, status, admin_remarks);

    // Emit socket events
    try {
      const io = getIO();
      // Notify the specific resident
      io.to(`resident-${existing.resident_id}`).emit('query:status-updated', updated);
      // If resolved, send special ack
      if (status === 'RESOLVED') {
        io.to(`resident-${existing.resident_id}`).emit('query:resolved', {
          query: updated,
          message: 'Your query has been resolved successfully.',
        });
        // Notify admin room
        io.emit('query:resolved-ack', updated);
      }
    } catch (_) { /* socket not critical */ }

    res.json({ success: true, message: 'Query status updated.', data: updated });
  } catch (error) {
    next(error);
  }
}

// ── Admin: Add remark ─────────────────────────────────────────────────────────
export async function addAdminRemark(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    const { admin_remarks } = req.body;

    if (!admin_remarks || !admin_remarks.trim()) {
      throw new BadRequestError('admin_remarks is required.');
    }

    const existing = await ResidentQueryModel.findById(id);
    if (!existing) throw new NotFoundError('Query not found.');

    const updated = await ResidentQueryModel.addRemark(id, admin_remarks.trim());

    // Notify resident of new remark
    try {
      const io = getIO();
      io.to(`resident-${existing.resident_id}`).emit('query:remark-added', updated);
    } catch (_) {}

    res.json({ success: true, message: 'Remark added.', data: updated });
  } catch (error) {
    next(error);
  }
}

// ── Admin: Delete query ───────────────────────────────────────────────────────
export async function deleteQuery(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);

    const existing = await ResidentQueryModel.findById(id);
    if (!existing) throw new NotFoundError('Query not found.');

    await ResidentQueryModel.delete(id);
    res.json({ success: true, message: 'Query deleted.' });
  } catch (error) {
    next(error);
  }
}

// ── Admin: Query stats for dashboard ─────────────────────────────────────────
export async function getQueryStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const stats = await ResidentQueryModel.getStats();
    res.json({ success: true, message: 'Query stats fetched.', data: stats });
  } catch (error) {
    next(error);
  }
}
