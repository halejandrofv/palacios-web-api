import type { BusinessProfileDto, NewBusinessProfile } from '../../dto/business-profile.dto';
export interface BusinessProfileRepository {
  create(input: NewBusinessProfile): Promise<BusinessProfileDto>;
}
