import { z } from 'zod';

export interface Bindings {
  DB: D1Database;
  BUSINESS_PROFILE_RATE_LIMITER: RateLimit;
  FRONTEND_ORIGINS?: string;
  CORS_ORIGINS?: string;
  ENABLE_SWAGGER?: string;
  INTERNAL_NOTIFICATION_EMAIL?: string;
  MAIL_FROM_EMAIL?: string;
  MAIL_FROM_NAME?: string;
  RESEND_API_KEY?: string;
}

const origin = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value.replace(/\/+$/, '');
    } catch {
      return false;
    }
  })
  .transform((value) => new URL(value).origin);

const httpConfig = z.object({
  FRONTEND_ORIGINS: z
    .string()
    .transform((value) => value.split(','))
    .pipe(z.array(origin).min(1)),
  ENABLE_SWAGGER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const emailConfig = z.object({
  INTERNAL_NOTIFICATION_EMAIL: z.email(),
  MAIL_FROM_EMAIL: z.email(),
  MAIL_FROM_NAME: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((value) => !/[\r\n]/.test(value)),
  RESEND_API_KEY: z.string().trim().min(1),
});

type HttpConfig = z.infer<typeof httpConfig>;

export type EmailConfig = z.infer<typeof emailConfig>;

export function readHttpConfig(env: Bindings): HttpConfig {
  return httpConfig.parse({
    FRONTEND_ORIGINS: env.FRONTEND_ORIGINS ?? env.CORS_ORIGINS,
    ENABLE_SWAGGER: env.ENABLE_SWAGGER,
  });
}

export function readEmailConfig(env: Bindings): EmailConfig {
  return emailConfig.parse(env);
}

export type ApiEnvironment = {
  Bindings: Bindings;
  Variables: { httpConfig: HttpConfig };
};
