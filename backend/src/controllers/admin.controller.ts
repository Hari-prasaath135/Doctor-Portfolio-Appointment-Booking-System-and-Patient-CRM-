import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { adminService } from '../services/admin.service';
import { sendSuccess, sendNoContent } from '../utils/response';

export class AdminController {
  async getDashboardStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await adminService.getDashboardStats();
      sendSuccess(res, stats);
    } catch (err) {
      next(err);
    }
  }

  async listUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = '1', limit = '20' } =
        req.query as Record<string, string>;

      const users = await adminService.listAllUsers(
        parseInt(page),
        parseInt(limit)
      );

      sendSuccess(res, users);
    } catch (err) {
      next(err);
    }
  }

  async assignRole(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { role } = req.body;

      await adminService.assignRole(id, role);

      sendSuccess(res, null, `Role ${role} assigned successfully`);
    } catch (err) {
      next(err);
    }
  }

  async toggleUserAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);
      const { disabled } = req.body;

      await adminService.toggleUserAccount(id, disabled);

      sendSuccess(
        res,
        null,
        `Account ${disabled ? 'disabled' : 'enabled'}`
      );
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      await adminService.deleteUser(id);

      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();