import path from 'path';
import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { Invoice } from '../models/Invoice.ts';
import { User } from '../models/User.ts';
import { ProcessedWebhookEvent } from '../models/ProcessedWebhookEvent.ts';
import {
  createInvoiceCheckoutSession,
  verifyWebhookSignature,
} from '../services/stripe.service.ts';
import { executeReceiptWorkflow } from '../services/receiptWorkflow.service.ts';
import { getStorageService } from '../services/storage.service.ts';
import { AppError, catchAsync } from '../middleware/errorHandler.ts';

/**
 * 1. Create Checkout Session using trusted MongoDB invoice data
 */
export const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const { invoiceId } = req.body;
  const user = req.user!;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // IDOR check: Clients can only checkout their own invoices
  if (user.role === 'client' && invoice.client.toString() !== user._id.toString()) {
    throw new AppError('Forbidden: You can only initiate payment for your own invoices', 403);
  }

  // Guard against invalid status transitions
  if (invoice.status === 'paid') {
    throw new AppError('This invoice has already been paid in full', 400);
  }
  if (invoice.status === 'cancelled') {
    throw new AppError('Cannot pay a cancelled invoice', 400);
  }
  if (invoice.status === 'draft') {
    throw new AppError('Draft invoices cannot be paid until published', 400);
  }

  const client = await User.findById(invoice.client);
  if (!client) {
    throw new AppError('Client user record not found', 404);
  }

  // Create Checkout Session with trusted server data
  const session = await createInvoiceCheckoutSession(invoice, client);

  invoice.stripeSessionId = session.id;
  await invoice.save();

  res.status(200).json({
    success: true,
    sessionId: session.id,
    checkoutUrl: session.url,
  });
});

/**
 * 2. Handle Stripe Webhook with Signature Verification, Idempotency, and Audit Verification
 */
export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string;

  if (!signature) {
    res.status(400).json({
      success: false,
      message: 'Missing Stripe signature header',
    });
    return;
  }

  // Use raw request body buffer
  const rawBody = (req as any).rawBody || req.body;
  if (!rawBody) {
    res.status(400).json({
      success: false,
      message: 'Empty request body received for webhook',
    });
    return;
  }

  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch (err: any) {
    res.status(400).json({
      success: false,
      message: `Invalid Stripe webhook signature: ${err.message}`,
    });
    return;
  }

  // 5. Idempotency Check: Check if this Stripe event ID was already processed
  const existingEvent = await ProcessedWebhookEvent.findOne({ eventId: event.id });
  if (existingEvent) {
    res.status(200).json({
      received: true,
      alreadyProcessed: true,
      message: `Event ${event.id} was already processed at ${existingEvent.processedAt.toISOString()}`,
    });
    return;
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // 4. Verify successful payment state
      if (session.payment_status !== 'paid') {
        await ProcessedWebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          status: 'ignored',
          details: { reason: `Session payment_status is '${session.payment_status}', not 'paid'` },
        });

        res.status(200).json({ received: true, ignored: true });
        return;
      }

      const invoiceId = session.metadata?.invoiceId || session.client_reference_id;
      if (!invoiceId) {
        await ProcessedWebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          status: 'failed',
          details: { error: 'No invoiceId present in session metadata or client_reference_id' },
        });

        res.status(400).json({ success: false, message: 'Missing invoice reference in session' });
        return;
      }

      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) {
        await ProcessedWebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          status: 'failed',
          details: { error: `Referenced invoice ${invoiceId} not found in database` },
        });

        res.status(404).json({ success: false, message: 'Referenced invoice not found' });
        return;
      }

      // 4. Verify invoice ownership mapping
      const metadataClientId = session.metadata?.clientId;
      if (metadataClientId && invoice.client.toString() !== metadataClientId) {
        const errorMsg = `Security Alert: Invoice ownership mismatch! Metadata client: ${metadataClientId}, Invoice client: ${invoice.client}`;
        invoice.paymentError = errorMsg;
        await invoice.save();

        await ProcessedWebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          invoiceId: invoice._id,
          status: 'failed',
          details: { error: errorMsg },
        });

        res.status(400).json({ success: false, message: errorMsg });
        return;
      }

      // 4. Verify expected amount
      const expectedAmountCents = Math.round(invoice.totalAmount * 100);
      const actualAmountCents = session.amount_total;

      if (actualAmountCents !== expectedAmountCents) {
        const errorMsg = `Payment amount mismatch: Expected ${expectedAmountCents} cents, but received ${actualAmountCents} cents`;
        invoice.paymentError = errorMsg;
        await invoice.save();

        await ProcessedWebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          invoiceId: invoice._id,
          status: 'failed',
          details: { error: errorMsg },
        });

        res.status(400).json({ success: false, message: errorMsg });
        return;
      }

      // 4. Verify currency
      const expectedCurrency = invoice.currency.toLowerCase();
      const actualCurrency = (session.currency || '').toLowerCase();

      if (actualCurrency !== expectedCurrency) {
        const errorMsg = `Payment currency mismatch: Expected ${expectedCurrency}, but received ${actualCurrency}`;
        invoice.paymentError = errorMsg;
        await invoice.save();

        await ProcessedWebhookEvent.create({
          eventId: event.id,
          eventType: event.type,
          invoiceId: invoice._id,
          status: 'failed',
          details: { error: errorMsg },
        });

        res.status(400).json({ success: false, message: errorMsg });
        return;
      }

      // All security checks passed: Mark Invoice as Paid
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      invoice.stripeSessionId = session.id;
      if (session.payment_intent) {
        invoice.stripePaymentIntentId =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent.id;
      }
      invoice.paymentError = undefined;
      await invoice.save();

      // Trigger Automated Receipt & Email Workflow
      try {
        await executeReceiptWorkflow(invoice._id);
      } catch (receiptErr: any) {
        console.error('[Receipt Workflow Error]:', receiptErr.message);
      }

      // Record successful event processing for idempotency
      await ProcessedWebhookEvent.create({
        eventId: event.id,
        eventType: event.type,
        invoiceId: invoice._id,
        status: 'processed',
        details: {
          invoiceNumber: invoice.invoiceNumber,
          amountPaid: session.amount_total,
          currency: session.currency,
        },
      });

      res.status(200).json({
        received: true,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: 'paid',
      });
      return;
    }

    // Default response for other webhook event types
    await ProcessedWebhookEvent.create({
      eventId: event.id,
      eventType: event.type,
      status: 'ignored',
    });

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Webhook Processing Error]:', err);
    res.status(500).json({
      success: false,
      message: `Webhook handler failed: ${err.message}`,
    });
  }
};

/**
 * 9. Manually retry receipt generation & delivery (Admin/Staff or Client self-service)
 */
export const retryReceiptDelivery = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user!;

  const invoice = await Invoice.findById(id);
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  // IDOR check
  if (user.role === 'client' && invoice.client.toString() !== user._id.toString()) {
    throw new AppError('Forbidden: You can only access receipts for your own invoices', 403);
  }

  if (invoice.status !== 'paid') {
    throw new AppError('Receipt can only be generated for paid invoices', 400);
  }

  const result = await executeReceiptWorkflow(invoice._id, { forceEmailResend: true });

  res.status(200).json({
    success: result.success,
    message: result.message,
    pdfUrl: result.pdfUrl,
  });
});

/**
 * Download stored PDF receipt (Protected with JWT authentication and strict IDOR check)
 */
export const downloadReceipt = catchAsync(async (req: Request, res: Response) => {
  const { filename } = req.params;
  const user = req.user!;

  if (!user) {
    throw new AppError('Authentication required to access receipt documents', 401);
  }

  // 1. Sanitize filename strictly against path traversal & format
  const sanitizedFilename = path.basename(filename);
  const match = sanitizedFilename.match(/^Receipt-(INV-[A-Za-z0-9-]+)\.pdf$/);
  if (!match) {
    throw new AppError('Invalid receipt filename format', 400);
  }

  const invoiceNumber = match[1];

  // 2. Look up the invoice from MongoDB
  const invoice = await Invoice.findOne({ invoiceNumber });
  if (!invoice) {
    throw new AppError('Invoice associated with this receipt does not exist', 404);
  }

  // 3. Strict IDOR Ownership Check
  if (user.role === 'client' && invoice.client.toString() !== user._id.toString()) {
    throw new AppError('Forbidden: You do not have permission to access receipts for this invoice', 403);
  }

  // 4. Verify file exists in storage abstraction
  const storage = getStorageService();
  const exists = await storage.exists(sanitizedFilename);
  if (!exists) {
    throw new AppError('Receipt file not found in storage', 404);
  }

  const buffer = await storage.get(sanitizedFilename);

  // Security Headers for file download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'");
  res.send(buffer);
});

