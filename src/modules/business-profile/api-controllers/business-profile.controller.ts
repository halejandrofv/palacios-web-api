import type { Handler } from 'hono';
import type { ApiEnvironment, Bindings } from '../../../config/environment';
import { errorResponse } from '@shared/http-error';
import type { BusinessProfileService } from '../business/business-profile.service';
import { validateBusinessProfile } from './parameters/create-business-profile.request';

export const businessProfilePath = '/api/v1/business-profile';

export function createBusinessProfile(
  makeBusinessService: (env: Bindings) => BusinessProfileService,
): Handler<ApiEnvironment> {
  return async (c) => {
    let body: unknown;
    try {
      body = await c.req.json<unknown>();
    } catch {
      return errorResponse(c, 400);
    }
    if (body === null || typeof body !== 'object') return errorResponse(c, 400);

    // Cloudflare sets this header on ingress. The fallback is shared for requests without an edge IP.
    const key = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const limit = await c.env.BUSINESS_PROFILE_RATE_LIMITER.limit({ key });
    if (!limit.success) {
      c.header('Retry-After', '60');
      return errorResponse(c, 429);
    }

    const input = validateBusinessProfile(body);
    const { referenceId } = await makeBusinessService(c.env).createSubmission(input);
    return c.json({ success: true, referenceId }, 201);
  };
}
