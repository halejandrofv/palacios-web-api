import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { Resend } from 'resend';
import {
  readEmailConfig,
  readHttpConfig,
  type ApiEnvironment,
  type Bindings,
} from './config/environment';
import { errorResponse, handleError } from '@shared/http-error';
import {
  businessProfilePath,
  createBusinessProfile,
} from './modules/business-profile/api-controllers/business-profile.controller';
import { BusinessProfileService } from './modules/business-profile/business/business-profile.service';
import { BusinessProfileEmailService } from './modules/business-profile/external-system/notifications/email/business-profile-email.service';
import { BusinessProfileDataAccessService } from './modules/business-profile/external-system/persistence/d1/business-profile-data-access.service';
import { registerSwagger } from './swagger';

function makeBusinessService(env: Bindings): BusinessProfileService {
  const config = readEmailConfig(env);
  return new BusinessProfileService(
    new BusinessProfileDataAccessService(env.DB),
    new BusinessProfileEmailService(config, new Resend(config.RESEND_API_KEY)),
  );
}

export function createApp(makeService = makeBusinessService): Hono<ApiEnvironment> {
  const app = new Hono<ApiEnvironment>({ strict: false });

  app.onError(handleError);
  app.notFound((c) => errorResponse(c, 404));
  app.use(secureHeaders());
  app.use(async (c, next) => {
    c.header(
      'Content-Security-Policy',
      "default-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    c.set('httpConfig', readHttpConfig(c.env));
    const origin = c.req.header('Origin');
    if (origin !== undefined && !c.var.httpConfig.FRONTEND_ORIGINS.includes(origin)) {
      c.header('Vary', 'Origin');
      return errorResponse(c, 403);
    }
    await next();
  });
  app.use(
    cors({
      origin: (origin) => origin || undefined,
      allowMethods: ['POST', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Accept'],
      maxAge: 86400,
    }),
  );
  app.post('*', async (c, next) => {
    const contentType = c.req.header('Content-Type') ?? '';
    const type = contentType.split(';', 1)[0]?.trim().toLowerCase();
    const encoding = c.req.header('Content-Encoding')?.toLowerCase() ?? 'identity';
    const charset = /;\s*charset\s*=\s*"?([^;"\s]+)/i.exec(contentType)?.[1];
    if (
      type !== 'application/json' ||
      encoding !== 'identity' ||
      (charset && charset.toLowerCase() !== 'utf-8')
    ) {
      return errorResponse(c, 415);
    }
    await next();
  });
  app.post('*', bodyLimit({ maxSize: 32 * 1024, onError: (c) => errorResponse(c, 413) }));
  app.post(businessProfilePath, createBusinessProfile(makeService));
  registerSwagger(app);
  return app;
}

export default createApp();
