import { Response, NextFunction, Request } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

type RequestPart = 'body' | 'query' | 'params';

/**
 * Zod validation middleware factory.
 *
 * Usage:
 *   router.post('/appointments', validate(createAppointmentSchema), controller)
 *   router.get('/appointments', validate(paginationSchema, 'query'), controller)
 *
 * On failure: throws ValidationError with per-field error messages.
 * On success: replaces req[part] with the parsed (typed + coerced) Zod output.
 */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[part]);

    if (result.success) {
      // Replace with Zod-parsed/coerced value
      (req as unknown as Record<string, unknown>)[part] = result.data;
      next();
      return;
    }

    const zodError = result.error as ZodError;
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of zodError.issues) {
      const field = issue.path.join('.') || '_root';
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(issue.message);
    }

    next(new ValidationError('Validation failed', fieldErrors));
  };
}
