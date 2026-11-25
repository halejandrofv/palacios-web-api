import { html } from 'hono/html';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { ApiEnvironment } from './config/environment';
import { businessProfilePath } from './modules/business-profile/api-controllers/business-profile.controller';
import { businessProfileRequest } from './modules/business-profile/api-controllers/parameters/create-business-profile.request';
import { errorResponse } from '@shared/http-error';

const base = '/api/v1/docs';
const specPath = base + '-json';
const swaggerAssets = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.31.0';

function document(): Record<string, unknown> {
  const errorSchema = z.toJSONSchema(
    z.object({
      success: z.literal(false),
      error: z.object({
        code: z.string(),
        message: z.string(),
        fields: z.record(z.string(), z.array(z.string())).optional(),
      }),
    }),
  );

  const errorDescriptions = {
    400: 'Invalid submission',
    403: 'Origin denied',
    413: 'Payload too large',
    415: 'Unsupported media type',
    429: 'Rate limit exceeded',
    500: 'Submission failed',
  };
  const errorResponses = Object.fromEntries(
    Object.entries(errorDescriptions).map(
      ([status, description]) =>
        [
          status,
          {
            description,
            content: { 'application/json': { schema: errorSchema } },
          },
        ] as const,
    ),
  );

  return {
    openapi: '3.1.0',
    info: {
      title: 'Palacios CPA API',
      description: 'Public business profile submissions',
      version: '1.0',
    },
    paths: {
      [businessProfilePath]: {
        post: {
          tags: ['Business Profile'],
          summary: 'Submit a business profile',
          description:
            'Saves the submission and sends an internal notification. Returns only a public reference.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: z.toJSONSchema(businessProfileRequest, { io: 'input' }),
              },
            },
          },
          responses: {
            201: {
              description: 'Submission received',
              content: {
                'application/json': {
                  schema: z.toJSONSchema(
                    z.object({
                      success: z.literal(true),
                      referenceId: z.string().regex(/^BP-[0-9]{8}-[A-F0-9]{6}$/),
                    }),
                  ),
                },
              },
            },
            ...errorResponses,
          },
        },
      },
    },
  };
}

export function registerSwagger(app: Hono<ApiEnvironment>): void {
  app.get(specPath, (c) =>
    c.var.httpConfig.ENABLE_SWAGGER ? c.json(document()) : errorResponse(c, 404),
  );
  app.get(base + '-yaml', (c) => {
    if (!c.var.httpConfig.ENABLE_SWAGGER) return errorResponse(c, 404);
    // JSON is valid YAML 1.2.
    return c.body(JSON.stringify(document(), null, 2), 200, { 'Content-Type': 'application/yaml' });
  });
  app.get(base, (c) => {
    if (!c.var.httpConfig.ENABLE_SWAGGER) return errorResponse(c, 404);
    const nonce = crypto.randomUUID();
    c.header(
      'Content-Security-Policy',
      [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' https://cdn.jsdelivr.net`,
        "style-src 'unsafe-inline' https://cdn.jsdelivr.net",
        'img-src data:',
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; '),
    );
    return c.html(html`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Palacios CPA API</title>
          <link rel="stylesheet" href="${swaggerAssets}/swagger-ui.css" />
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="${swaggerAssets}/swagger-ui-bundle.js" crossorigin="anonymous"></script>
          <script nonce="${nonce}">
            SwaggerUIBundle({ dom_id: '#swagger-ui', url: '${specPath}', validatorUrl: null });
          </script>
        </body>
      </html>
    `);
  });
}
