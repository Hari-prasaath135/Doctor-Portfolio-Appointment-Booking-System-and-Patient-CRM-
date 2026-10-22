import { Response } from 'express';
import { PaginatedResult } from '../types';

// ─── Standard API response shape ─────────────────────────────────────────────

interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

/**
 * Send a 200/201 success response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200
): Response {
  const body: ApiResponse<T> = { success: true, message, data };
  return res.status(statusCode).json(body);
}

/**
 * Send a created (201) response.
 */
export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): Response {
  return sendSuccess(res, data, message, 201);
}

/**
 * Send an error response.
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  errors?: Record<string, string[]>
): Response {
  const body: ApiResponse<null> = { success: false, error: message, errors };
  return res.status(statusCode).json(body);
}

/**
 * Send a paginated list response.
 */
export function sendPaginated<T>(
  res: Response,
  result: PaginatedResult<T>,
  message = 'Success'
): Response {
  return res.status(200).json({
    success: true,
    message,
    data: result.data,
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
    },
  });
}

/**
 * Send a 204 No Content response.
 */
export function sendNoContent(res: Response): Response {
  return res.status(204).send();
}
