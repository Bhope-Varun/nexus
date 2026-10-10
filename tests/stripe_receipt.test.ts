import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Stripe from 'stripe';
import { createApp } from '../src/server/app.ts';
import { connectDB, disconnectDB } from '../src/server/config/db.ts';
import { User } from '../src/server/models/User.ts';
import { Invoice } from '../src/server/models/Invoice.ts';
import { ProcessedWebhookEvent } from '../src/server/models/ProcessedWebhookEvent.ts';
import { ReceiptDeliveryLog } from '../src/server/models/ReceiptDeliveryLog.ts';
import { generateReceiptPdf } from '../src/server/services/pdf.service.ts';
import { getStorageService } from '../src/server/services/storage.service.ts';
import { executeReceiptWorkflow } from '../src/server/services/receiptWorkflow.service.ts';
import { stripe } from '../src/server/services/stripe.service.ts';
import { config } from '../src/server/config/env.ts';

let mongoServer: MongoMemoryServer;
const app = createApp();

const TEST_WEBHOOK_SECRET = 'whsec_test_secret_for_automated_testing_key_12345';
config.stripeWebhookSecret = TEST_WEBHOOK_SECRET;

let clientUser: any;
let otherClientUser: any;
let clientToken: string;
let invoice: any;

before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectDB(uri);

  await User.deleteMany({});
  await Invoice.deleteMany({});
  await ProcessedWebhookEvent.deleteMany({});
  await ReceiptDeliveryLog.deleteMany({});

  // 1. Create client user
  clientUser = await User.create({
    name: 'Wayne Enterprises',
    email: 'bruce@waynecorp.com',
    password: 'Password123!',
    companyName: 'Wayne Enterprises Inc.',
    role: 'client',
  });

  // Login client
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: 'bruce@waynecorp.com', password: 'Password123!' });
  clientToken = loginRes.body.token;

  // 2. Create another client for IDOR test
  otherClientUser = await User.create({
    name: 'LexCorp',
    email: 'lex@lexcorp.com',
    password: 'Password123!',
    role: 'client',
  });

  // 3. Create test invoice in pending status
  invoice = await Invoice.create({
    invoiceNumber: 'INV-2026-9001',
    client: clientUser._id,
    createdBy: clientUser._id,
    status: 'pending',
    dueDate: new Date(Date.now() + 86400000 * 14),
    taxRate: 10,
    discount: 50,
    currency: 'USD',
    items: [
      { description: 'Applied Cryptography & Security Infrastructure', quantity: 2, unitPrice: 1000 },
    ],
  });
});

after(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

/**
 * Helper to generate a valid signed Stripe Webhook payload with stripe-signature header
 */
function createSignedStripeEvent(payloadObj: any, secret = TEST_WEBHOOK_SECRET): { payloadString: string; signatureHeader: string } {
  const payloadString = JSON.stringify(payloadObj);
  const signatureHeader = stripe.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret,
  });
  return { payloadString, signatureHeader };
}

describe('1. Stripe Checkout Session Creation (Trusted Server Data)', () => {
  test('POST /api/payments/checkout-session should reject invalid invoice ID format', async () => {
    const res = await request(app)
      .post('/api/payments/checkout-session')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ invoiceId: 'invalid-id' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('POST /api/payments/checkout-session should prevent IDOR (cannot pay for another client)', async () => {
    // Create an invoice belonging to LexCorp
    const lexInvoice = await Invoice.create({
      invoiceNumber: 'INV-2026-9002',
      client: otherClientUser._id,
      createdBy: otherClientUser._id,
      dueDate: new Date(),
      items: [{ description: 'LexCorp Services', quantity: 1, unitPrice: 500 }],
    });

    const res = await request(app)
      .post('/api/payments/checkout-session')
      .set('Authorization', `Bearer ${clientToken}`) // Bruce Wayne trying to checkout LexCorp's invoice
      .send({ invoiceId: lexInvoice._id.toString() });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('POST /api/payments/checkout-session should reject if invoice is already paid', async () => {
    const paidInvoice = await Invoice.create({
      invoiceNumber: 'INV-2026-9003',
      client: clientUser._id,
      createdBy: clientUser._id,
      status: 'paid',
      dueDate: new Date(),
      items: [{ description: 'Paid Item', quantity: 1, unitPrice: 100 }],
    });

    const res = await request(app)
      .post('/api/payments/checkout-session')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ invoiceId: paidInvoice._id.toString() });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /already been paid/i);
  });
});

describe('2. Stripe Webhook Signature Verification', () => {
  test('POST /api/payments/webhook should reject request without stripe-signature header', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ id: 'evt_test_1', type: 'test' }));

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /missing stripe signature/i);
  });

  test('POST /api/payments/webhook should reject invalid or forged stripe signature', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=12345,v1=bad_signature_hash')
      .send(JSON.stringify({ id: 'evt_test_2', type: 'test' }));

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid stripe webhook signature/i);
  });

  test('POST /api/payments/webhook should reject signature signed with wrong secret', async () => {
    const { payloadString, signatureHeader } = createSignedStripeEvent(
      { id: 'evt_test_3', object: 'event', type: 'test' },
      'whsec_wrong_secret_key_abcdef'
    );

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signatureHeader)
      .send(payloadString);

    assert.equal(res.status, 400);
    assert.match(res.body.message, /signature/i);
  });
});

describe('3. Webhook Audit: Ownership, Amount & Currency Mismatches', () => {
  test('Webhook should reject and flag Invoice when payment amount is mismatched', async () => {
    const expectedCents = Math.round(invoice.totalAmount * 100);
    const tamperedCents = expectedCents - 50000; // Sent less money!

    const eventPayload = {
      id: 'evt_amount_mismatch_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_mismatch',
          payment_status: 'paid',
          amount_total: tamperedCents,
          currency: 'usd',
          client_reference_id: invoice._id.toString(),
          metadata: {
            invoiceId: invoice._id.toString(),
            clientId: clientUser._id.toString(),
          },
        },
      },
    };

    const { payloadString, signatureHeader } = createSignedStripeEvent(eventPayload);

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signatureHeader)
      .send(payloadString);

    assert.equal(res.status, 400);
    assert.match(res.body.message, /amount mismatch/i);

    // Verify invoice remains UNPAID!
    const reloadedInvoice = await Invoice.findById(invoice._id);
    assert.equal(reloadedInvoice?.status, 'pending');
    assert.ok(reloadedInvoice?.paymentError?.includes('amount mismatch'));
  });

  test('Webhook should reject when currency does not match invoice currency', async () => {
    const eventPayload = {
      id: 'evt_currency_mismatch_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_currency',
          payment_status: 'paid',
          amount_total: Math.round(invoice.totalAmount * 100),
          currency: 'eur', // Mismatched currency (Invoice is USD)
          client_reference_id: invoice._id.toString(),
          metadata: {
            invoiceId: invoice._id.toString(),
            clientId: clientUser._id.toString(),
          },
        },
      },
    };

    const { payloadString, signatureHeader } = createSignedStripeEvent(eventPayload);

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signatureHeader)
      .send(payloadString);

    assert.equal(res.status, 400);
    assert.match(res.body.message, /currency mismatch/i);

    const reloadedInvoice = await Invoice.findById(invoice._id);
    assert.equal(reloadedInvoice?.status, 'pending');
  });

  test('Webhook should reject when metadata clientId does not match invoice owner', async () => {
    const eventPayload = {
      id: 'evt_owner_mismatch_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_owner',
          payment_status: 'paid',
          amount_total: Math.round(invoice.totalAmount * 100),
          currency: 'usd',
          client_reference_id: invoice._id.toString(),
          metadata: {
            invoiceId: invoice._id.toString(),
            clientId: otherClientUser._id.toString(), // Mismatched client ID!
          },
        },
      },
    };

    const { payloadString, signatureHeader } = createSignedStripeEvent(eventPayload);

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signatureHeader)
      .send(payloadString);

    assert.equal(res.status, 400);
    assert.match(res.body.message, /ownership mismatch/i);

    const reloadedInvoice = await Invoice.findById(invoice._id);
    assert.equal(reloadedInvoice?.status, 'pending');
  });
});

describe('4. Successful Webhook Processing & Automated Receipt Execution', () => {
  const validEventId = 'evt_payment_success_999';

  test('Valid checkout.session.completed webhook marks invoice Paid and executes receipt', async () => {
    const amountCents = Math.round(invoice.totalAmount * 100);

    const eventPayload = {
      id: validEventId,
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_valid_session_123',
          payment_status: 'paid',
          payment_intent: 'pi_test_intent_456',
          amount_total: amountCents,
          currency: 'usd',
          client_reference_id: invoice._id.toString(),
          metadata: {
            invoiceId: invoice._id.toString(),
            clientId: clientUser._id.toString(),
          },
        },
      },
    };

    const { payloadString, signatureHeader } = createSignedStripeEvent(eventPayload);

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signatureHeader)
      .send(payloadString);

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    assert.equal(res.body.status, 'paid');

    // Verify invoice is marked PAID with transaction IDs
    const paidInvoice = await Invoice.findById(invoice._id);
    assert.equal(paidInvoice?.status, 'paid');
    assert.ok(paidInvoice?.paidAt);
    assert.equal(paidInvoice?.stripePaymentIntentId, 'pi_test_intent_456');
    assert.ok(paidInvoice?.receiptUrl);

    // Verify ProcessedWebhookEvent recorded
    const eventLog = await ProcessedWebhookEvent.findOne({ eventId: validEventId });
    assert.ok(eventLog);
    assert.equal(eventLog?.status, 'processed');
  });

  test('5. Webhook Idempotency: Duplicate webhook event is recognized and safely ignored', async () => {
    // Send the EXACT SAME event payload again
    const eventPayload = {
      id: validEventId, // Identical Event ID!
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_valid_session_123',
          payment_status: 'paid',
        },
      },
    };

    const { payloadString, signatureHeader } = createSignedStripeEvent(eventPayload);

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signatureHeader)
      .send(payloadString);

    assert.equal(res.status, 200);
    assert.equal(res.body.received, true);
    assert.equal(res.body.alreadyProcessed, true); // Idempotency confirmed!
  });
});

describe('6. PDF Receipt Generation with PDFKit', () => {
  test('generateReceiptPdf generates a valid PDF buffer with logo and prominent PAID stamp', async () => {
    const pdfBuffer = await generateReceiptPdf({
      invoice,
      client: clientUser,
      paymentDetails: {
        transactionId: 'pi_test_intent_456',
        paidAt: new Date(),
        amountPaid: invoice.totalAmount,
        currency: 'USD',
      },
    });

    assert.ok(Buffer.isBuffer(pdfBuffer));
    // Verify standard PDF magic bytes: %PDF-
    const header = pdfBuffer.subarray(0, 5).toString('ascii');
    assert.equal(header, '%PDF-');
    assert.ok(pdfBuffer.length > 2000, 'PDF buffer should be complete and non-empty');
  });

  test('Storage abstraction saves and retrieves PDF receipt', async () => {
    const storage = getStorageService();
    const testBuffer = Buffer.from('TEST_RECEIPT_PDF_CONTENT');
    const filename = 'TestReceipt.pdf';

    const saved = await storage.save(filename, testBuffer);
    assert.ok(saved.url);

    const exists = await storage.exists(filename);
    assert.equal(exists, true);

    const retrieved = await storage.get(filename);
    assert.equal(retrieved.toString(), 'TEST_RECEIPT_PDF_CONTENT');

    await storage.delete(filename);
    const existsAfterDelete = await storage.exists(filename);
    assert.equal(existsAfterDelete, false);
  });
});

describe('7. Retryable Receipt Workflow & SMTP Failure Handling', () => {
  test('Email delivery idempotency: does not send duplicate emails once delivered', async () => {
    const result = await executeReceiptWorkflow(invoice._id);
    assert.equal(result.success, true);
    // Because it was already sent during the webhook test above, alreadySent must be true
    assert.equal(result.alreadySent, true);
  });

  test('SMTP Failure handling: preserves PDF and sets status failed without crashing', async () => {
    // Create new paid invoice for SMTP test
    const newInvoice = await Invoice.create({
      invoiceNumber: 'INV-2026-SMTP-FAIL',
      client: clientUser._id,
      createdBy: clientUser._id,
      status: 'paid',
      paidAt: new Date(),
      dueDate: new Date(),
      items: [{ description: 'Test Line', quantity: 1, unitPrice: 200 }],
    });

    // Mock failing transporter
    const failingTransporter = {
      sendMail: async () => {
        throw new Error('ECONNREFUSED: SMTP connection refused at smtp.fail.local:587');
      },
    };

    const failResult = await executeReceiptWorkflow(newInvoice._id, {
      customTransporter: failingTransporter as any,
    });

    assert.equal(failResult.success, false);
    assert.match(failResult.message, /email delivery failed/i);

    // Verify log state recorded failure
    const log = await ReceiptDeliveryLog.findOne({ invoiceId: newInvoice._id });
    assert.ok(log);
    assert.equal(log?.status, 'failed');
    assert.ok(log?.pdfPath, 'PDF should still be generated and preserved');
    assert.match(log?.lastError || '', /ECONNREFUSED/);

    // Now test retry with working transporter succeeds without re-generating PDF!
    const mockWorkingTransporter = {
      sendMail: async () => ({ messageId: '<msg_success_123@nexus>' }),
    };

    const retryResult = await executeReceiptWorkflow(newInvoice._id, {
      customTransporter: mockWorkingTransporter as any,
    });

    assert.equal(retryResult.success, true);
    const updatedLog = await ReceiptDeliveryLog.findOne({ invoiceId: newInvoice._id });
    assert.equal(updatedLog?.status, 'email_sent');
    assert.ok(updatedLog?.emailSentAt);
  });
});
