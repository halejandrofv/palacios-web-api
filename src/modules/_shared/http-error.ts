import type { Context } from 'hono';
import type { ApiEnvironment } from '../../config/environment';
import { ApplicationError, ValidationError } from './errors/application.error';

const errors = {
  400: { code: 'VALIDATION_ERROR', message: 'The submitted information is invalid.' },
  403: { code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed.' },
  404: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body is too large.' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Use application/json.' },
  429: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
  500: { code: 'SUBMISSION_FAILED', message: 'We could not process your request.' },
} as const;

export function errorResponse(
  c: Pick<Context, 'json'>,
  status: keyof typeof errors,
  fields?: Record<string, string[]>,
): Response {
  return c.json(
    { success: false, error: { ...errors[status], ...(fields && { fields }) } },
    status,
  );
}

export function handleError(error: unknown, c: Context<ApiEnvironment>): Response {
  if (error instanceof ValidationError) return errorResponse(c, 400, error.fields);
  console.error({
    referenceId: error instanceof ApplicationError ? error.referenceId : undefined,
    category: error instanceof ApplicationError ? error.category : 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
  });
  return errorResponse(c, 500);
}
