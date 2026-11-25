import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import { PersistenceError, ReferenceConflictError } from '@shared/errors/persistence.error';
import { readEmailConfig, type Bindings } from '../src/config/environment';
import { createApp } from '../src/index';
import { BusinessProfileService } from '../src/modules/business-profile/business/business-profile.service';
import {
  BusinessProfileEmailService,
  type ResendClient,
} from '../src/modules/business-profile/external-system/notifications/email/business-profile-email.service';
import { BusinessProfileDataAccessService } from '../src/modules/business-profile/external-system/persistence/d1/business-profile-data-access.service';
import { businessProfileSubmissions } from '../src/modules/business-profile/external-system/persistence/d1/schema';
import { savedProfile, validInput } from './fixtures/business-profile';

describe('D1 in Wrangler with mocked Resend', () => {
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<Bindings>>>;
  let env: Bindings;
  let repository: BusinessProfileDataAccessService;
  const send = vi.fn<ResendClient['emails']['send']>();
  const app = createApp(
    () =>
      new BusinessProfileService(
        repository,
        new BusinessProfileEmailService(readEmailConfig(env), { emails: { send } }),
      ),
  );

  beforeAll(async () => {
    proxy = await getPlatformProxy<Bindings>({ persist: false });
    env = {
      ...proxy.env,
      BUSINESS_PROFILE_RATE_LIMITER: {
        limit: (): Promise<RateLimitOutcome> => Promise.resolve({ success: true }),
      },
      ENABLE_SWAGGER: 'false',
      MAIL_FROM_NAME: 'Palacios CPA',
      MAIL_FROM_EMAIL: 'info@palacioscpa.com',
      INTERNAL_NOTIFICATION_EMAIL: 'notifications@example.test',
      RESEND_API_KEY: 're_fixture',
    };
    const migration = await readFile('drizzle/0000_init.sql', 'utf8');
    for (const sql of migration.split('--> statement-breakpoint')) {
      await env.DB.prepare(sql.trim()).run();
    }
    repository = new BusinessProfileDataAccessService(env.DB);
  }, 20000);

  beforeEach(() => {
    send
      .mockReset()
      .mockResolvedValue({ data: { id: 'resend-fixture' }, error: null, headers: null });
  });

  afterAll(async () => {
    await proxy?.dispose();
  });

  async function post(body: object): Promise<Response> {
    return app.request(
      '/api/v1/business-profile',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      env,
    );
  }

  it('persists the Astro request, returns the public reference and builds the Resend payload', async () => {
    const email = 'integration@example.test';
    const response = await post({
      ...validInput,
      email: email.toUpperCase(),
      additionalMessage: ' ',
    });
    expect(response.status).toBe(201);
    const body = await response.json<{ success: true; referenceId: string }>();
    expect(Object.keys(body).sort()).toEqual(['referenceId', 'success']);
    const [row] = await drizzle(env.DB)
      .select()
      .from(businessProfileSubmissions)
      .where(eq(businessProfileSubmissions.referenceId, body.referenceId));
    expect(row).toMatchObject({
      email,
      status: 'new',
      source: 'website',
      additionalMessage: null,
      ipHash: null,
      userAgent: null,
      services: validInput.services,
      id: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
      createdAt: expect.any(Date) as unknown,
      updatedAt: expect.any(Date) as unknown,
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Palacios CPA <info@palacioscpa.com>',
        to: ['notifications@example.test'],
        replyTo: email,
        html: expect.stringContaining(body.referenceId) as unknown,
      }),
      { idempotencyKey: `business-profile-${body.referenceId}` },
    );
  });

  it('keeps the lead when Resend returns an error', async () => {
    const email = 'mail-failure@example.test';
    send.mockResolvedValueOnce({
      data: null,
      headers: null,
      error: { name: 'validation_error', statusCode: 400, message: 'Simulated failure' },
    });
    expect((await post({ ...validInput, email })).status).toBe(500);
    expect(
      await drizzle(env.DB)
        .select()
        .from(businessProfileSubmissions)
        .where(eq(businessProfileSubmissions.email, email)),
    ).toHaveLength(1);
  });

  it('returns a business projection and translates only reference collisions', async () => {
    const input = { ...savedProfile, referenceId: 'BP-20260907-ABC123' };
    const row = await repository.create(input);
    expect(row).toEqual({ ...input, createdAt: expect.any(Date) as unknown });
    await expect(repository.create(input)).rejects.toBeInstanceOf(ReferenceConflictError);
    const invalid = repository.create({
      ...input,
      referenceId: 'too-long-for-the-reference-column',
    });
    await expect(invalid).rejects.toBeInstanceOf(PersistenceError);
    await expect(invalid).rejects.not.toBeInstanceOf(ReferenceConflictError);
  });

  it('enforces length and JSON array constraints and preserves SQLite indexes', async () => {
    const profile = await repository.create({ ...savedProfile, referenceId: 'BP-20260907-ABC124' });
    await expect(
      env.DB.prepare('UPDATE business_profile_submissions SET services = ? WHERE reference_id = ?')
        .bind('{"not":"an array"}', profile.referenceId)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare(
        'UPDATE business_profile_submissions SET additional_message = ? WHERE reference_id = ?',
      )
        .bind('x'.repeat(1201), profile.referenceId)
        .run(),
    ).rejects.toThrow();
    const { results } = await env.DB.prepare(
      'PRAGMA index_list(business_profile_submissions)',
    ).all<{ name: string }>();
    expect(results.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        'business_profile_submissions_reference_id_key',
        'business_profile_submissions_created_at_idx',
        'business_profile_submissions_status_idx',
      ]),
    );
  });
});
