import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/server/app.ts';
import { connectDB, disconnectDB } from '../src/server/config/db.ts';
import { User } from '../src/server/models/User.ts';
import { Invoice } from '../src/server/models/Invoice.ts';
import { getStorageService } from '../src/server/services/storage.service.ts';

let mongoServer: MongoMemoryServer;
const app = createApp();

let clientAUser: any;
let clientAToken: string;

let clientBUser: any;
let clientBToken: string;

let adminUser: any;
let adminToken: string;

let clientAInvoice: any;
let clientBInvoice: any;

before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectDB(uri);

  await User.deleteMany({});
  await Invoice.deleteMany({});

  // Create Client A
  clientAUser = await User.create({
    name: 'Alice Client',
    email: 'alice@audit.com',
    password: 'Password123!',
    role: 'client',
    companyName: 'Alice Enterprises',
  });

  const loginResA = await request(app)
    .post('/api/auth/login')
    .send({ email: 'alice@audit.com', password: 'Password123!' });
  clientAToken = loginResA.body.token;

  // Create Client B
  clientBUser = await User.create({
    name: 'Bob Client',
    email: 'bob@audit.com',
    password: 'Password123!',
    role: 'client',
    companyName: 'Bob Logistics',
  });

  const loginResB = await request(app)
    .post('/api/auth/login')
    .send({ email: 'bob@audit.com', password: 'Password123!' });
  clientBToken = loginResB.body.token;

  // Create Admin
  adminUser = await User.create({
    name: 'Admin Auditor',
    email: 'admin@audit.com',
    password: 'Password123!',
    role: 'admin',
  });

  const loginResAdmin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@audit.com', password: 'Password123!' });
  adminToken = loginResAdmin.body.token;

  // Create Invoice for Client A
  clientAInvoice = await Invoice.create({
    invoiceNumber: 'INV-2026-AUDIT-A',
    client: clientAUser._id,
    createdBy: adminUser._id,
    status: 'paid',
    paidAt: new Date(),
    dueDate: new Date(Date.now() + 86400000),
    items: [{ description: 'Security Consulting', quantity: 1, unitPrice: 2000 }],
  });

  // Save a mock receipt in storage for Client A
  const storage = getStorageService();
  await storage.save('Receipt-INV-2026-AUDIT-A.pdf', Buffer.from('%PDF-1.4 Mock Receipt for Alice'));

  // Create Invoice for Client B
  clientBInvoice = await Invoice.create({
    invoiceNumber: 'INV-2026-AUDIT-B',
    client: clientBUser._id,
    createdBy: adminUser._id,
    status: 'paid',
    paidAt: new Date(),
    dueDate: new Date(Date.now() + 86400000),
    items: [{ description: 'Logistics Software', quantity: 1, unitPrice: 3500 }],
  });

  await storage.save('Receipt-INV-2026-AUDIT-B.pdf', Buffer.from('%PDF-1.4 Mock Receipt for Bob'));
});

after(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('SECURITY AUDIT SUITE 1: Administrative Endpoint Protection Against Client Accounts', () => {
  test('ATTACK 1: Client attempting GET /api/auth/users must return 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /forbidden/i);
  });

  test('ATTACK 2: Client attempting POST /api/invoices (create) must return 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({
        client: clientAUser._id.toString(),
        dueDate: new Date().toISOString(),
        items: [{ description: 'Unauthorized Invoice', quantity: 1, unitPrice: 500 }],
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('ATTACK 3: Client attempting PUT /api/invoices/:id must return 403 Forbidden', async () => {
    const res = await request(app)
      .put(`/api/invoices/${clientAInvoice._id}`)
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ notes: 'Hacked Notes' });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('ATTACK 4: Client attempting PATCH /api/invoices/:id/status must return 403 Forbidden', async () => {
    const res = await request(app)
      .patch(`/api/invoices/${clientAInvoice._id}/status`)
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ status: 'paid' });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('ATTACK 5: Client attempting DELETE /api/invoices/:id must return 403 Forbidden', async () => {
    const res = await request(app)
      .delete(`/api/invoices/${clientAInvoice._id}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });
});

describe('SECURITY AUDIT SUITE 2: IDOR Protection on Invoices & Payments', () => {
  test('ATTACK 6: Client A attempting GET /api/invoices/:clientB_invoice_id must return 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/invoices/${clientBInvoice._id}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /another account/i);
  });

  test('ATTACK 7: Client A attempting checkout session with Client B invoice ID must return 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/payments/checkout-session')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ invoiceId: clientBInvoice._id.toString() });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('ATTACK 8: Client A attempting to resend receipt for Client B invoice must return 403 Forbidden', async () => {
    const res = await request(app)
      .post(`/api/invoices/${clientBInvoice._id}/receipt/resend`)
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
  });

  test('DEFENSE 9: Client A listing invoices with ?client=<ClientB_id> query returns only Client A invoices', async () => {
    const res = await request(app)
      .get(`/api/invoices?client=${clientBUser._id.toString()}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 200);
    const invoiceIds = res.body.data.map((inv: any) => inv._id);
    assert.ok(invoiceIds.includes(clientAInvoice._id.toString()));
    assert.ok(!invoiceIds.includes(clientBInvoice._id.toString()));
  });
});

describe('SECURITY AUDIT SUITE 3: Unauthorized PDF Receipt Downloads & IDOR Guards', () => {
  test('ATTACK 10: Unauthenticated download of receipt PDF must return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/receipts/download/Receipt-INV-2026-AUDIT-A.pdf');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('ATTACK 11: Client A attempting to download Client B receipt PDF must return 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/receipts/download/Receipt-INV-2026-AUDIT-B.pdf')
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /permission to access receipts/i);
  });

  test('ATTACK 12: Directory traversal attempt in receipt download must return 400 Bad Request', async () => {
    const res = await request(app)
      .get('/api/receipts/download/..%2f..%2fpackage.json')
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('DEFENSE 13: Authorized Client A downloading own receipt PDF succeeds (200 OK)', async () => {
    const res = await request(app)
      .get('/api/receipts/download/Receipt-INV-2026-AUDIT-A.pdf')
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.match(res.body.toString('utf-8'), /Mock Receipt for Alice/);
  });

  test('DEFENSE 14: Admin can download any client receipt PDF (200 OK)', async () => {
    const res = await request(app)
      .get('/api/receipts/download/Receipt-INV-2026-AUDIT-B.pdf')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
  });
});

describe('SECURITY AUDIT SUITE 4: Privilege Escalation & Mass Assignment Defense', () => {
  test('DEFENSE 15: Public registration requesting role: "admin" is forcibly assigned "client"', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker User',
        email: 'hacker@audit.com',
        password: 'Password123!',
        role: 'admin', // Malicious attempt to self-promote to admin
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'client'); // Server must strictly force 'client'
  });

  test('DEFENSE 16: Profile update (PATCH /api/auth/me) ignores injected role field', async () => {
    const res = await request(app)
      .patch('/api/auth/me')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({
        name: 'Alice Renamed',
        role: 'admin', // Malicious attempt to change role via profile update
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'client'); // Role remains client!

    // Verify database record
    const reloaded = await User.findById(clientAUser._id);
    assert.equal(reloaded?.role, 'client');
  });

  test('DEFENSE 17: Invoice creation rejecting status: "paid" (must be draft or pending)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client: clientAUser._id.toString(),
        dueDate: new Date().toISOString(),
        status: 'paid', // Not allowed at creation
        items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('DEFENSE 18: Invoice creation rejecting discount greater than subtotal', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client: clientAUser._id.toString(),
        dueDate: new Date().toISOString(),
        discount: 500, // Greater than subtotal (100)
        items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      });

    assert.equal(res.status, 400);
    assert.match(res.body.message, /discount cannot exceed subtotal/i);
  });
});

describe('SECURITY AUDIT SUITE 5: NoSQL Injection & ReDoS Mitigation', () => {
  test('DEFENSE 19: Malicious regex characters in search do not trigger ReDoS or 500 errors', async () => {
    const maliciousReDoS = '.*.*.*.*.*.*.*.*.*.*a';
    const res = await request(app)
      .get(`/api/auth/users?search=${encodeURIComponent(maliciousReDoS)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  test('DEFENSE 20: Malicious regex characters in invoice search do not trigger ReDoS', async () => {
    const maliciousRegex = '[a-z]+((([a-z]+)+)+)+';
    const res = await request(app)
      .get(`/api/invoices?search=${encodeURIComponent(maliciousRegex)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});
