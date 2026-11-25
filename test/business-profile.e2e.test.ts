import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/index';
import type { Bindings } from '../src/config/environment';
import { BusinessProfileService } from '../src/modules/business-profile/business/business-profile.service';
import type { NewBusinessProfile } from '../src/modules/business-profile/dto/business-profile.dto';
import { validInput } from './fixtures/business-profile';

const endpoint = '/api/v1/business-profile';

describe('POST /api/v1/business-profile', () => {
  const create = vi.fn((input: NewBusinessProfile) =>
    Promise.resolve({ ...input, createdAt: new Date() }),
  );
  const sendInternalNotification = vi.fn<(submission: unknown) => Promise<void>>();
  const limit = vi.fn<RateLimit['limit']>();
  const env = {
    FRONTEND_ORIGINS: 'https://palacioscpa.com,http://localhost:4321',
    ENABLE_SWAGGER: 'true',
    BUSINESS_PROFILE_RATE_LIMITER: { limit },
  } satisfies Omit<Bindings, 'DB'>;
  const app = createApp(() => new BusinessProfileService({ create }, { sendInternalNotification }));
  const send = async (body: object, headers?: Record<string, string>): Promise<Response> =>
    app.request(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      },
      env,
    );

  beforeEach(() => {
    vi.resetAllMocks();
    limit.mockResolvedValue({ success: true });
  });

  it('accepts the exact Astro JSON and returns only success and referenceId', async () => {
    const response = await send(validInput);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      referenceId: expect.stringMatching(/^BP-[0-9]{8}-[A-F0-9]{6}$/) as unknown,
    });
    expect(sendInternalNotification).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing firstName', { ...validInput, firstName: undefined }],
    ['business structure', { ...validInput, businessStructure: 'invalid' }],
    ['duplicate service', { ...validInput, services: ['bookkeeping', 'bookkeeping'] }],
    ['unknown service', { ...validInput, services: ['unknown'] }],
    ['empty services', { ...validInput, services: [] }],
    ['services not array', { ...validInput, services: 'bookkeeping' }],
    ['revenue', { ...validInput, annualRevenue: 'invalid' }],
    ['team', { ...validInput, teamSize: 'invalid' }],
    ['accounting', { ...validInput, accountingMethod: 'invalid' }],
    ['preferred contact', { ...validInput, preferredContactMethod: 'invalid' }],
    ['email', { ...validInput, email: 'invalid' }],
    ['phone', { ...validInput, phone: '2815551212' }],
    ['long message', { ...validInput, additionalMessage: 'x'.repeat(1201) }],
    ['unknown property', { ...validInput, consent: true }],
    ['controlled status', { ...validInput, status: 'qualified' }],
    ['blank name', { ...validInput, firstName: '  ' }],
    ['explicit null message', { ...validInput, additionalMessage: null }],
    ['empty body', {}],
  ])('rejects %s', async (_label, body) => {
    const response = await send(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted information is invalid.',
        fields: expect.any(Object) as unknown,
      },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('preserves the required email error wording', async () => {
    const response = await send({ ...validInput, email: 'bad' });
    expect(await response.json()).toEqual({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The submitted information is invalid.',
        fields: { email: ['Please provide a valid email address.'] },
      },
    });
  });

  it('preserves the original field messages and their display order', async () => {
    const response = await send({
      ...validInput,
      services: ['unknown', 'unknown'],
      firstName: ' ',
      phone: null,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        fields: {
          firstName: ['firstName must be longer than or equal to 1 characters'],
          phone: ['Please provide a valid international phone number.', 'phone must be a string'],
          services: [
            'each value in services must be one of the following values: tax-preparation, tax-planning, bookkeeping, accounting, payroll, business-advisory, irs-tax-issues, business-formation',
            "All services's elements must be unique",
          ],
        },
      },
    });
  });

  it('does not echo unknown fields or their values', async () => {
    const response = await send({ ...validInput, 'private field name': 'private field value' });
    const body = await response.text();
    expect(body).toContain('_unknown');
    expect(body).not.toContain('private field');
  });

  it('normalizes names, email and whitespace-only messages', async () => {
    const response = await send({
      ...validInput,
      email: ' JOHN@EXAMPLE.COM ',
      firstName: ' John   Paul ',
      additionalMessage: ' ',
    });
    expect(response.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        firstName: 'John Paul',
        additionalMessage: null,
      }),
    );
  });

  it('accepts omitted optional message', async () => {
    expect((await send({ ...validInput, additionalMessage: undefined })).status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ additionalMessage: null }));
  });

  it.each(['D1', 'Resend'])('returns a controlled error on %s failure', async (system) => {
    if (system === 'D1') create.mockRejectedValue(new Error('private database detail'));
    else sendInternalNotification.mockRejectedValue(new Error('private mail detail'));
    const response = await send(validInput);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: 'SUBMISSION_FAILED', message: 'We could not process your request.' },
    });
    expect(create).toHaveBeenCalledTimes(1);
    if (system === 'D1') expect(sendInternalNotification).not.toHaveBeenCalled();
  });

  it('keys throttling by the Cloudflare IP and ignores forwarding headers', async () => {
    limit.mockResolvedValueOnce({ success: false });
    const response = await send(validInput, {
      'CF-Connecting-IP': '192.0.2.5',
      'X-Forwarded-For': '192.0.2.20',
    });
    expect(limit).toHaveBeenCalledWith({ key: '192.0.2.5' });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(await response.json()).toEqual({
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' },
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects unauthorized origins before persistence', async () => {
    const response = await send(validInput, { Origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('allows listed origins on POST and preflight and sets security headers', async () => {
    const response = await send(validInput, { Origin: 'http://localhost:4321' });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4321');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    const preflight = await app.request(
      endpoint,
      {
        method: 'OPTIONS',
        headers: { Origin: 'https://palacioscpa.com', 'Access-Control-Request-Method': 'POST' },
      },
      env,
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('Access-Control-Allow-Methods')).toBe('POST,OPTIONS');
    expect(preflight.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('rejects oversized bodies with and without a declared length', async () => {
    const payload = { ...validInput, additionalMessage: 'x'.repeat(34000) };
    expect((await send(payload)).status).toBe(413);
    const response = await send(payload, { 'Content-Length': '34200' });
    expect(response.status).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON with a safe envelope', async () => {
    const response = await app.request(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{broken:secret',
      },
      env,
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('secret');
  });

  it.each([
    'multipart/form-data',
    'application/x-www-form-urlencoded',
    'text/plain',
    'application/json; charset=latin1',
  ])('rejects content type %s', async (type) => {
    expect((await send(validInput, { 'Content-Type': type })).status).toBe(415);
  });

  it('rejects compressed bodies', async () => {
    expect((await send(validInput, { 'Content-Encoding': 'gzip' })).status).toBe(415);
  });

  it('has no old form endpoints', async () => {
    const response = await app.request(
      '/api/contact',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validInput),
      },
      env,
    );
    expect(response.status).toBe(404);
  });

  it('documents the endpoint in Swagger when enabled', async () => {
    const spec = await app.request('/api/v1/docs-json', {}, env);
    expect(spec.status).toBe(200);
    expect(await spec.text()).toContain(endpoint);
    const docs = await app.request('/api/v1/docs', {}, env);
    expect(docs.status).toBe(200);
    expect(docs.headers.get('Content-Security-Policy')).toContain("'nonce-");
    expect(await docs.text()).toContain('SwaggerUIBundle');
    const yaml = await app.request('/api/v1/docs-yaml', {}, env);
    expect(yaml.headers.get('Content-Type')).toBe('application/yaml');
    expect(await yaml.text()).toContain(endpoint);
    expect(
      (await app.request('/api/v1/docs-json', {}, { ...env, ENABLE_SWAGGER: 'false' })).status,
    ).toBe(404);
  });
});
