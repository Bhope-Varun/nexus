import { Router } from 'express';
import express from 'express';
import {
  createCheckoutSession,
  handleStripeWebhook,
  retryReceiptDelivery,
  downloadReceipt,
} from '../controllers/payment.controller.ts';
import { authenticateToken } from '../middleware/auth.ts';
import { validate } from '../middleware/validate.ts';
import { checkoutSessionSchema } from '../validators/payment.validator.ts';
import { idParamSchema } from '../validators/invoice.validator.ts';

const router = Router();

// 1. Stripe Webhook route - MUST use raw body for signature verification
// Mounted with express.raw middleware
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

import { checkoutLimiter } from '../middleware/rateLimiter.ts';

// 2. Create Stripe Checkout Session (Authenticated, IDOR-protected, Rate-limited)
router.post(
  '/checkout-session',
  checkoutLimiter,
  authenticateToken,
  validate({ body: checkoutSessionSchema }),
  createCheckoutSession
);

// 3. Resend/Retry Receipt Delivery (Authenticated)
router.post(
  '/invoices/:id/receipt/resend',
  authenticateToken,
  validate({ params: idParamSchema }),
  retryReceiptDelivery
);

// 4. Download Receipt PDF (Authenticated & IDOR protected)
router.get(
  '/receipts/download/:filename',
  authenticateToken,
  downloadReceipt
);

export default router;
