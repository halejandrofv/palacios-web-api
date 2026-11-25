import { randomBytes } from 'node:crypto';
import { PersistenceError, ReferenceConflictError } from '@shared/errors/persistence.error';
import { NotificationError } from '@shared/errors/notification.error';
import { type BusinessProfileRepository } from './ports/business-profile.repository';
import { type BusinessProfileNotificationPort } from './ports/business-profile-notification.port';
import type { BusinessProfileInput, NewBusinessProfile } from '../dto/business-profile.dto';
export function generateReferenceId(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `BP-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
export class BusinessProfileService {
  constructor(
    private readonly repository: BusinessProfileRepository,
    private readonly notification: BusinessProfileNotificationPort,
  ) {}
  async createSubmission(input: BusinessProfileInput): Promise<{ referenceId: string }> {
    const normalized: Omit<NewBusinessProfile, 'referenceId'> = {
      businessStructure: input.businessStructure,
      services: [...input.services],
      annualRevenue: input.annualRevenue,
      teamSize: input.teamSize,
      accountingMethod: input.accountingMethod,
      firstName: input.firstName.trim().replace(/\s+/g, ' '),
      lastName: input.lastName.trim().replace(/\s+/g, ' '),
      email: input.email.trim().toLowerCase(),
      phone: input.phone.trim(),
      preferredContactMethod: input.preferredContactMethod,
      additionalMessage: input.additionalMessage?.trim() || null,
      status: 'new',
      source: 'website',
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      const referenceId = generateReferenceId();
      let submission;
      try {
        submission = await this.repository.create({ ...normalized, referenceId });
      } catch (error: unknown) {
        if (error instanceof ReferenceConflictError && attempt < 2) continue;
        throw new PersistenceError(referenceId);
      }
      try {
        await this.notification.sendInternalNotification(submission);
      } catch {
        throw new NotificationError(referenceId);
      }
      return { referenceId: submission.referenceId };
    }
    throw new PersistenceError();
  }
}
