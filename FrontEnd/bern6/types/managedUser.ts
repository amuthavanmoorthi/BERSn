import { z } from 'zod';

export const USER_ROLE_VALUES = ['SYS_ADMIN', 'AGENCY_USER', 'VENDOR_USER'] as const;

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
    role: z.enum(USER_ROLE_VALUES),
    organization: buildOptionalTextField(150),
    department: buildOptionalTextField(150),
    position: buildOptionalTextField(150),
});

export type ManagedUserCreateInput = z.output<typeof managedUserCreateSchema>;
