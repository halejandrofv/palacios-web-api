import isEmail from 'validator/lib/isEmail.js';
import { z, type ZodEnum, type ZodString } from 'zod';
import { ValidationError } from '@shared/errors/application.error';
import type { BusinessProfileInput } from '../../dto/business-profile.dto';
import {
  ACCOUNTING_METHODS,
  ANNUAL_REVENUES,
  BUSINESS_STRUCTURES,
  CONTACT_METHODS,
  SERVICES,
  TEAM_SIZES,
} from '../../domain/business-profile.enums';

function optionMessage(field: string, values: readonly string[]): string {
  return `${field} must be one of the following values: ${values.join(', ')}`;
}

function option<const Values extends readonly [string, ...string[]]>(
  field: string,
  values: Values,
): ZodEnum<{ [Value in Values[number]]: Value }> {
  return z.enum(values, { error: optionMessage(field, values) });
}

function name(field: 'firstName' | 'lastName'): ZodString {
  return z
    .string()
    .trim()
    .refine((value) => value.length >= 1, `${field} must be longer than or equal to 1 characters`)
    .refine(
      (value) => [...value].length <= 100,
      `${field} must be shorter than or equal to 100 characters`,
    )
    .meta({ minLength: 1, maxLength: 100 });
}

const emailMessage = 'Please provide a valid email address.';
const emailLengthMessage = 'email must be shorter than or equal to 254 characters';
const phoneMessage = 'Please provide a valid international phone number.';
const messageLength = 'additionalMessage must be shorter than or equal to 1200 characters';
const serviceMessages = {
  option: optionMessage('each value in services', SERVICES),
  unique: "All services's elements must be unique",
  max: `services must contain no more than ${SERVICES.length} elements`,
  min: 'services must contain at least 1 elements',
  array: 'services must be an array',
};

export const businessProfileRequest = z.strictObject({
  businessStructure: option('businessStructure', BUSINESS_STRUCTURES),
  services: z
    .array(z.enum(SERVICES, { error: serviceMessages.option }))
    .min(1, serviceMessages.min)
    .max(SERVICES.length, serviceMessages.max)
    .refine((values) => new Set(values).size === values.length, {
      message: serviceMessages.unique,
      when: ({ value }) => Array.isArray(value),
    })
    .meta({ uniqueItems: true }),
  annualRevenue: option('annualRevenue', ANNUAL_REVENUES),
  teamSize: option('teamSize', TEAM_SIZES),
  accountingMethod: option('accountingMethod', ACCOUNTING_METHODS),
  firstName: name('firstName'),
  lastName: name('lastName'),
  email: z
    .string()
    .trim()
    .refine((value) => [...value].length <= 254, emailLengthMessage)
    .refine((value) => isEmail(value), emailMessage)
    .meta({ maxLength: 254, format: 'email' }),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{7,14}$/, phoneMessage),
  preferredContactMethod: option('preferredContactMethod', CONTACT_METHODS),
  additionalMessage: z
    .string()
    .refine((value) => [...value].length <= 1200, messageLength)
    .meta({ maxLength: 1200 })
    .optional(),
});

function invalidTypeMessages(field: string, value: unknown): string[] | undefined {
  switch (field) {
    case 'firstName':
    case 'lastName': {
      const lengthMessage =
        value === null || value === undefined
          ? `${field} must be longer than or equal to 1 characters`
          : `${field} must be longer than or equal to 1 and shorter than or equal to 100 characters`;
      return [lengthMessage, `${field} must be a string`];
    }
    case 'email':
      return [emailLengthMessage, emailMessage];
    case 'phone':
      return [phoneMessage, 'phone must be a string'];
    case 'additionalMessage':
      return [messageLength, 'additionalMessage must be a string'];
    case 'services': {
      const consideredValidOption = SERVICES.some((service) => service === value);
      const messages = Object.values(serviceMessages);
      return consideredValidOption ? messages.slice(1) : messages;
    }
  }
}

export function validateBusinessProfile(body: unknown): BusinessProfileInput {
  const result = businessProfileRequest.safeParse(body);
  if (result.success) return result.data;

  const fields = Object.create(null) as Record<string, string[]>;
  if (Array.isArray(body)) {
    throw new ValidationError({
      undefined: ['an unknown value was passed to the validate function'],
    });
  }
  const input = (body ?? {}) as Record<string, unknown>;
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      fields._unknown = ['Unexpected fields are not allowed.'];
      continue;
    }
    const field = String(issue.path[0] ?? '_unknown');
    const messages = (fields[field] ??= []);
    const additions =
      issue.code === 'invalid_type' ? invalidTypeMessages(field, input[field]) : undefined;
    for (const message of additions ?? [issue.message]) {
      if (!messages.includes(message)) messages.push(message);
    }
  }
  if (fields.services) {
    // Astro displays the first message, so keep the original order when several checks fail.
    fields.services = Object.values(serviceMessages).filter((message) =>
      fields.services?.includes(message),
    );
  }
  throw new ValidationError(fields);
}
