import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type {
  AccountingMethod,
  AnnualRevenue,
  BusinessStructure,
  ContactMethod,
  Service,
  SubmissionStatus,
  TeamSize,
} from '../../../domain/business-profile.enums';

export const businessProfileSubmissions = sqliteTable(
  'business_profile_submissions',
  {
    id: text()
      .primaryKey()
      .notNull()
      .$defaultFn(() => crypto.randomUUID()),
    referenceId: text('reference_id').notNull(),
    businessStructure: text('business_structure').$type<BusinessStructure>().notNull(),
    services: text({ mode: 'json' }).$type<Service[]>().notNull(),
    annualRevenue: text('annual_revenue').$type<AnnualRevenue>().notNull(),
    teamSize: text('team_size').$type<TeamSize>().notNull(),
    accountingMethod: text('accounting_method').$type<AccountingMethod>().notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    preferredContactMethod: text('preferred_contact_method').$type<ContactMethod>().notNull(),
    additionalMessage: text('additional_message'),
    status: text().$type<SubmissionStatus>().notNull().default('new'),
    source: text().notNull().default('website'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(round(unixepoch('subsec') * 1000))`),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('business_profile_submissions_reference_id_key').on(table.referenceId),
    index('business_profile_submissions_created_at_idx').on(table.createdAt),
    index('business_profile_submissions_status_idx').on(table.status),
    check('business_profile_reference_id_length', sql`length(${table.referenceId}) <= 18`),
    check('business_profile_structure_length', sql`length(${table.businessStructure}) <= 30`),
    check(
      'business_profile_services_array',
      sql`json_valid(${table.services}) AND json_type(${table.services}) = 'array'`,
    ),
    check('business_profile_revenue_length', sql`length(${table.annualRevenue}) <= 20`),
    check('business_profile_team_length', sql`length(${table.teamSize}) <= 20`),
    check('business_profile_accounting_length', sql`length(${table.accountingMethod}) <= 30`),
    check('business_profile_first_name_length', sql`length(${table.firstName}) <= 100`),
    check('business_profile_last_name_length', sql`length(${table.lastName}) <= 100`),
    check('business_profile_email_length', sql`length(${table.email}) <= 254`),
    check('business_profile_phone_length', sql`length(${table.phone}) <= 16`),
    check(
      'business_profile_contact_method_length',
      sql`length(${table.preferredContactMethod}) <= 10`,
    ),
    check('business_profile_message_length', sql`length(${table.additionalMessage}) <= 1200`),
    check('business_profile_status_length', sql`length(${table.status}) <= 20`),
    check('business_profile_source_length', sql`length(${table.source}) <= 20`),
    check('business_profile_ip_hash_length', sql`length(${table.ipHash}) <= 64`),
    check('business_profile_user_agent_length', sql`length(${table.userAgent}) <= 500`),
  ],
);
