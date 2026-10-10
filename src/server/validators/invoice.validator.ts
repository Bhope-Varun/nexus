import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
export const objectIdSchema = z
  .string()
  .regex(objectIdRegex, 'Must be a valid 24-character hexadecimal MongoDB ObjectId');

export const invoiceItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Item description cannot be empty')
    .max(200, 'Item description cannot exceed 200 characters'),
  quantity: z
    .number()
    .min(1, 'Quantity must be at least 1'),
  unitPrice: z
    .number()
    .min(0, 'Unit price cannot be negative'),
});

export const createInvoiceSchema = z.object({
  client: objectIdSchema,
  invoiceNumber: z
    .string()
    .trim()
    .min(3, 'Invoice number must be at least 3 characters')
    .max(50, 'Invoice number cannot exceed 50 characters')
    .optional(),
  items: z
    .array(invoiceItemSchema)
    .min(1, 'Invoice must have at least one line item'),
  taxRate: z
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .optional()
    .default(0),
  discount: z
    .number()
    .min(0, 'Discount cannot be negative')
    .optional()
    .default(0),
  currency: z
    .string()
    .trim()
    .length(3, 'Currency must be a 3-letter code (e.g. USD)')
    .toUpperCase()
    .optional()
    .default('USD'),
  status: z
    .enum(['draft', 'pending'])
    .optional()
    .default('pending'),
  issueDate: z.string().datetime().or(z.string().date()).optional(),
  dueDate: z
    .string()
    .min(1, 'Due date is required'),
  notes: z.string().trim().max(1000).optional(),
  paymentTerms: z.string().trim().max(100).optional(),
});

export const updateInvoiceSchema = z.object({
  client: objectIdSchema.optional(),
  items: z
    .array(invoiceItemSchema)
    .min(1, 'Invoice must have at least one line item')
    .optional(),
  taxRate: z.number().min(0).max(100).optional(),
  discount: z.number().min(0).optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  status: z
    .enum(['draft', 'pending', 'paid', 'overdue', 'cancelled'])
    .optional(),
  issueDate: z.string().datetime().or(z.string().date()).optional(),
  dueDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentTerms: z.string().trim().max(100).optional(),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['draft', 'pending', 'paid', 'overdue', 'cancelled']),
});

export const queryInvoiceSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  status: z
    .enum(['draft', 'pending', 'paid', 'overdue', 'cancelled'])
    .optional(),
  client: objectIdSchema.optional(),
  search: z.string().trim().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z
    .enum(['dueDate', 'issueDate', 'totalAmount', 'createdAt', 'invoiceNumber'])
    .optional()
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const idParamSchema = z.object({
  id: objectIdSchema,
});
