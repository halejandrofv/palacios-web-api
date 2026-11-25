export const BUSINESS_STRUCTURES = [
  'llc',
  's-corp',
  'c-corp',
  'partnership',
  'sole-proprietorship',
  'individual',
  'not-sure',
] as const;
export const SERVICES = [
  'tax-preparation',
  'tax-planning',
  'bookkeeping',
  'accounting',
  'payroll',
  'business-advisory',
  'irs-tax-issues',
  'business-formation',
] as const;
export const ANNUAL_REVENUES = [
  'under-100k',
  '100k-250k',
  '250k-500k',
  '500k-1m',
  '1m-5m',
  '5m-plus',
] as const;
export const TEAM_SIZES = ['just-me', '2-5', '6-10', '11-25', '26-50', '50-plus'] as const;
export const ACCOUNTING_METHODS = [
  'self-managed',
  'in-house',
  'another-accountant',
  'accounting-software',
  'not-managed',
] as const;
export const CONTACT_METHODS = ['call', 'email', 'text'] as const;
export const SUBMISSION_STATUSES = ['new', 'contacted', 'qualified', 'closed', 'spam'] as const;
export type BusinessStructure = (typeof BUSINESS_STRUCTURES)[number];
export type Service = (typeof SERVICES)[number];
export type AnnualRevenue = (typeof ANNUAL_REVENUES)[number];
export type TeamSize = (typeof TEAM_SIZES)[number];
export type AccountingMethod = (typeof ACCOUNTING_METHODS)[number];
export type ContactMethod = (typeof CONTACT_METHODS)[number];
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];
export const LABELS: Record<
  BusinessStructure | Service | AnnualRevenue | TeamSize | AccountingMethod | ContactMethod,
  string
> = {
  llc: 'LLC',
  's-corp': 'S Corporation',
  'c-corp': 'C Corporation',
  partnership: 'Partnership',
  'sole-proprietorship': 'Sole Proprietorship',
  individual: 'Individual',
  'not-sure': 'Not Sure',
  'tax-preparation': 'Tax Preparation',
  'tax-planning': 'Tax Planning',
  bookkeeping: 'Bookkeeping',
  accounting: 'Accounting',
  payroll: 'Payroll',
  'business-advisory': 'Business Advisory',
  'irs-tax-issues': 'IRS Tax Issues',
  'business-formation': 'Business Formation',
  'under-100k': 'Under $100,000',
  '100k-250k': '$100,000–$250,000',
  '250k-500k': '$250,000–$500,000',
  '500k-1m': '$500,000–$1 million',
  '1m-5m': '$1–$5 million',
  '5m-plus': '$5 million+',
  'just-me': 'Just Me',
  '2-5': '2–5',
  '6-10': '6–10',
  '11-25': '11–25',
  '26-50': '26–50',
  '50-plus': '50+',
  'self-managed': 'Self Managed',
  'in-house': 'In House',
  'another-accountant': 'Another Accountant',
  'accounting-software': 'Accounting Software',
  'not-managed': 'Not Managed',
  call: 'Call',
  email: 'Email',
  text: 'Text',
};
