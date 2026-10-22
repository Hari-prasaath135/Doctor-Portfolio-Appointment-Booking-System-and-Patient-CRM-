import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { queryService } from '../services/query.service';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export class QueryController {
  async submitQuery(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const patientId =
        req.user['role'] === 'PATIENT'
          ? req.user.uid
          : req.body.patientId;

      const { subject, message } = req.body;

      const query = await queryService.submitQuery(
        patientId,
        subject,
        message
      );

      sendCreated(res, query, 'Query submitted successfully');
    } catch (err) {
      next(err);
    }
  }

  async getQuery(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const id = String(req.params.id);

      const query = await queryService.getQueryById(id);

      if (
        req.user['role'] === 'PATIENT' &&
        query.patientId !== req.user.uid
      ) {
        throw new ForbiddenError('You can only view your own queries');
      }

      sendSuccess(res, query);
    } catch (err) {
      next(err);
    }
  }

  async listQueries(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new UnauthorizedError();

      const role = req.user['role'];

      let queries;

      if (role === 'PATIENT') {
        queries = await queryService.getQueriesByPatient(req.user.uid);
      } else {
        queries = await queryService.listAllQueries(
          req.query.status as any
        );
      }

      sendSuccess(res, queries);
    } catch (err) {
      next(err);
    }
  }

  async assignQuery(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const query = await queryService.assignQuery(
        id,
        req.body.doctorId
      );

      sendSuccess(res, query, 'Query assigned to doctor');
    } catch (err) {
      next(err);
    }
  }

  async resolveQuery(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      const query = await queryService.resolveQuery(
        id,
        req.body.response
      );

      sendSuccess(res, query, 'Query resolved');
    } catch (err) {
      next(err);
    }
  }

  async closeQuery(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = String(req.params.id);

      await queryService.closeQuery(id);

      sendSuccess(res, null, 'Query closed');
    } catch (err) {
      next(err);
    }
  }
}

export const queryController = new QueryController();