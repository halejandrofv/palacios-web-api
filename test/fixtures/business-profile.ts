import type {
  BusinessProfileInput,
  BusinessProfileDto,
} from '../../src/modules/business-profile/dto/business-profile.dto';
export const validInput: BusinessProfileInput = {
  businessStructure: 'llc',
  services: ['tax-preparation', 'bookkeeping'],
  annualRevenue: '250k-500k',
  teamSize: '2-5',
  accountingMethod: 'another-accountant',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john@example.com',
  phone: '+12815551212',
  preferredContactMethod: 'email',
  additionalMessage: 'I would like to discuss my accounting needs.',
};
export const savedProfile: BusinessProfileDto = {
  ...validInput,
  additionalMessage: validInput.additionalMessage ?? null,
  referenceId: 'BP-20260907-8F3A21',
  createdAt: new Date('2026-09-07T12:00:00Z'),
  status: 'new',
  source: 'website',
};
