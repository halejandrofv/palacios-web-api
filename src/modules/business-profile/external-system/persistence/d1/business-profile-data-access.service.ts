import { getTableColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { PersistenceError, ReferenceConflictError } from '@shared/errors/persistence.error';
import type { BusinessProfileRepository } from '../../../business/ports/business-profile.repository';
import type { BusinessProfileDto, NewBusinessProfile } from '../../../dto/business-profile.dto';
import { businessProfileSubmissions } from './schema';

const { id, ipHash, userAgent, updatedAt, ...businessProfileSelect } = getTableColumns(
  businessProfileSubmissions,
);
// Only business fields are returned by INSERT; internal identifiers and request metadata stay in D1.
void [id, ipHash, userAgent, updatedAt];

export class BusinessProfileDataAccessService implements BusinessProfileRepository {
  constructor(private readonly db: D1Database) {}

  async create(input: NewBusinessProfile): Promise<BusinessProfileDto> {
    try {
      const [row] = await drizzle(this.db)
        .insert(businessProfileSubmissions)
        .values(input)
        .onConflictDoNothing({ target: businessProfileSubmissions.referenceId })
        .returning(businessProfileSelect);
      if (!row) throw new ReferenceConflictError(input.referenceId);
      return { ...row, status: input.status, source: input.source };
    } catch (error) {
      if (error instanceof ReferenceConflictError) throw error;
      throw new PersistenceError(input.referenceId);
    }
  }
}
