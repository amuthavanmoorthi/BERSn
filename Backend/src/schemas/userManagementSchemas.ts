import { z } from 'zod';

export const USER_ROLE_VALUES = ['SYS_ADMIN', 'AGENCY_USER', 'VENDOR_USER'] as const;

export type UserRoleValue = typeof USER_ROLE_VALUES[number];

export const userRoleSchema = z.enum(USER_ROLE_VALUES);

function sanitizeHumanText(value: string, maxLength: number): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function buildRequiredTextField(label: string, maxLength: number) {
  return z.string()
    .trim()
    .min(1, `${label} is required.`)
    .max(maxLength, `${label} must be ${maxLength} characters or fewer.`)
    .transform((value) => sanitizeHumanText(value, maxLength))
    .refine((value) => value.length > 0, `${label} is required.`);
}

function buildOptionalTextField(maxLength: number) {
  return z.string()
    .optional()
    .default('')
    .transform((value) => sanitizeHumanText(value, maxLength));
}

export const managedUserCreateSchema = z.object({
  name: buildRequiredTextField('Name', 150),
  email: z.string()
    .trim()
    .toLowerCase()
    .max(254, 'Email must be 254 characters or fewer.')
    .email('Email must be a valid email address.'),
  role: userRoleSchema,
  organization: buildOptionalTextField(150),
  department: buildOptionalTextField(150),
  position: buildOptionalTextField(150),
});

export const managedUserStatusSchema = z.object({
  is_active: z.boolean(),
});

export type ManagedUserCreateInput = z.output<typeof managedUserCreateSchema>;
export type ManagedUserStatusInput = z.output<typeof managedUserStatusSchema>;
