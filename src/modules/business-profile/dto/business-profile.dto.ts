import type {
  AccountingMethod,
  AnnualRevenue,
  BusinessStructure,
  ContactMethod,
  Service,
  TeamSize,
} from '../domain/business-profile.enums';
export interface BusinessProfileInput {
  businessStructure: BusinessStructure;
  services: Service[];
  annualRevenue: AnnualRevenue;
  teamSize: TeamSize;
  accountingMethod: AccountingMethod;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredContactMethod: ContactMethod;
  additionalMessage?: string;
}
export interface NewBusinessProfile extends Omit<BusinessProfileInput, 'additionalMessage'> {
  referenceId: string;
  additionalMessage: string | null;
  status: 'new';
  source: 'website';
}
export interface BusinessProfileDto extends NewBusinessProfile {
  createdAt: Date;
}
