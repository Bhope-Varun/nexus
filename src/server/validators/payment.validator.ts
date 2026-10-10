import { z } from 'zod';
import { objectIdSchema } from './invoice.validator.ts';

export const checkoutSessionSchema = z.object({
  invoiceId: objectIdSchema,
});
