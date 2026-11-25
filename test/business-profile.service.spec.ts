import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BusinessProfileService,
  generateReferenceId,
} from '../src/modules/business-profile/business/business-profile.service';
import type { NewBusinessProfile } from '../src/modules/business-profile/dto/business-profile.dto';
import { NotificationError } from '@shared/errors/notification.error';
import { PersistenceError, ReferenceConflictError } from '@shared/errors/persistence.error';
import { validInput } from './fixtures/business-profile';
describe('BusinessProfileService', () => {
  const create = vi.fn((input: NewBusinessProfile) =>
    Promise.resolve({ ...input, createdAt: new Date() }),
  );
  const sendInternalNotification = vi.fn<(submission: unknown) => Promise<void>>();
  let business: BusinessProfileService;
  beforeEach(() => {
    vi.resetAllMocks();
    create.mockImplementation((input) => Promise.resolve({ ...input, createdAt: new Date() }));
    sendInternalNotification.mockResolvedValue(undefined);
    business = new BusinessProfileService({ create }, { sendInternalNotification });
  });
  it('normalizes and persists before notifying; returns no UUID or PII', async () => {
    const result = await business.createSubmission({
      ...validInput,
      firstName: ' John   Paul ',
      lastName: ' Smith  Jr ',
      email: ' JOHN@EXAMPLE.COM ',
      phone: ' +12815551212 ',
      additionalMessage: '  ',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'John Paul',
        lastName: 'Smith Jr',
        email: 'john@example.com',
        phone: validInput.phone,
        additionalMessage: null,
        status: 'new',
        source: 'website',
      }),
    );
    expect(sendInternalNotification).toHaveBeenCalledTimes(1);
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      sendInternalNotification.mock.invocationCallOrder[0] ?? 0,
    );
    expect(Object.keys(result)).toEqual(['referenceId']);
  });
  it('uses UTC and cryptographic-format unique references', () => {
    vi.useFakeTimers().setSystemTime(new Date('2026-09-07T00:00:01Z'));
    try {
      const references = Array.from({ length: 50 }, generateReferenceId);
      expect(new Set(references).size).toBe(50);
      expect(references.every((value) => /^BP-20260907-[A-F0-9]{6}$/.test(value))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('retries a reference conflict and sends only once', async () => {
    create.mockRejectedValueOnce(new ReferenceConflictError());
    await business.createSubmission(validInput);
    expect(create).toHaveBeenCalledTimes(2);
    expect(sendInternalNotification).toHaveBeenCalledTimes(1);
  });
  it('bounds collisions to three attempts', async () => {
    create.mockRejectedValue(new ReferenceConflictError());
    await expect(business.createSubmission(validInput)).rejects.toBeInstanceOf(PersistenceError);
    expect(create).toHaveBeenCalledTimes(3);
    expect(sendInternalNotification).not.toHaveBeenCalled();
  });
  it('does not retry an unrelated persistence failure', async () => {
    create.mockRejectedValue(new Error('private database error'));
    await expect(business.createSubmission(validInput)).rejects.toThrow('PERSISTENCE_ERROR');
    expect(create).toHaveBeenCalledTimes(1);
    expect(sendInternalNotification).not.toHaveBeenCalled();
  });
  it('reports email failure after preserving the insert', async () => {
    sendInternalNotification.mockRejectedValue(new Error('private Resend failure'));
    await expect(business.createSubmission(validInput)).rejects.toBeInstanceOf(NotificationError);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
