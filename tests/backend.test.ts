import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/server/app.ts';
import { connectDB, disconnectDB } from '../src/server/config/db.ts';
import { User } from '../src/server/models/User.ts';
import { Invoice } from '../src/server/models/Invoice.ts';

let mongoServer: MongoMemoryServer;
const app = createApp();

let adminToken: string;
let staffToken: string;
let clientAToken: string;
let clientBToken: string;

let adminUser: any;
let clientAUser: any;
let clientBUser: any;

let clientAInvoiceId: string;
let clientBInvoiceId: string;

before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectDB(uri);

  // Clear any existing test data
  await User.deleteMany({});
  await Invoice.deleteMany({});
});

after(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('1. Health Check & Security Headers', () => {
  test('GET /api/health should return 200 and database connected status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.service, 'Nexus Corporate Backend');
    assert.equal(res.body.database.isConnected, true);
  });
});

describe('2. User Registration & Validation', () => {
  test('POST /api/auth/register should fail on invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'invalid-email',
        password: 'Password123!',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Validation failed');
  });

  test('POST /api/auth/register should fail on password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'John Doe',
        email: 'valid@example.com',
        password: '123',
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
  });

  test('POST /api/auth/register should successfully register Client A and force role client', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Client',
        email: 'alice@client.com',
        password: 'SecurePassword123!',
        companyName: 'Acme Corp',
        role: 'admin', // Attempts privilege escalation - must be ignored/forced to client!
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.role, 'client'); // Crucial security check!
    assert.ok(res.body.token);

    clientAToken = res.body.token;
    clientAUser = res.body.user;
  });

  test('POST /api/auth/register should fail on duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Duplicate',
        email: 'alice@client.com',
        password: 'AnotherPassword123!',
      });
    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  test('Create Client B directly in database', async () => {
    const user = await User.create({
      name: 'Bob Client',
      email: 'bob@client.com',
      password: 'SecurePassword123!',
      companyName: 'Globex Ltd',
      role: 'client',
    });
    clientBUser = user;

    // Login as Client B to get token
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'bob@client.com',
        password: 'SecurePassword123!',
      });
    assert.equal(res.status, 200);
    clientBToken = res.body.token;
  });

  test('Create Admin and Staff users in database', async () => {
    adminUser = await User.create({
      name: 'Root Administrator',
      email: 'admin@nexus.com',
      password: 'AdminPassword123!',
      role: 'admin',
    });

    const staffUser = await User.create({
      name: 'Sarah Staff',
      email: 'staff@nexus.com',
      password: 'StaffPassword123!',
      role: 'staff',
    });

    // Login Admin
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@nexus.com',
        password: 'AdminPassword123!',
      });
    assert.equal(adminRes.status, 200);
    adminToken = adminRes.body.token;

    // Login Staff
    const staffRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'staff@nexus.com',
        password: 'StaffPassword123!',
      });
    assert.equal(staffRes.status, 200);
    staffToken = staffRes.body.token;
  });
});

describe('3. Login & Authentication Flow', () => {
  test('POST /api/auth/login should fail on incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice@client.com',
        password: 'WrongPassword!',
      });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('GET /api/auth/me should fail when no authorization header is provided', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  test('GET /api/auth/me should fail with malformed or tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid-token-string');
    assert.equal(res.status, 401);
  });

  test('GET /api/auth/me should succeed with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${clientAToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'alice@client.com');
  });
});

describe('4. Role-Based Access Control (RBAC)', () => {
  test('GET /api/auth/users should forbid Client access (403)', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${clientAToken}`);
    assert.equal(res.status, 403);
  });

  test('GET /api/auth/users should permit Admin access (200)', async () => {
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.length >= 4);
  });
});

describe('5. Invoice Creation & Validation', () => {
  test('POST /api/invoices should forbid Client from creating invoices (403)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({
        client: clientAUser.id,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
      });
    assert.equal(res.status, 403);
  });

  test('POST /api/invoices should reject invoice with zero quantity or negative price', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client: clientAUser.id,
        dueDate: new Date(Date.now() + 86400000).toISOString(),
        items: [{ description: 'Test Item', quantity: 0, unitPrice: -50 }],
      });
    assert.equal(res.status, 400);
  });

  test('Admin creates invoice for Client A (calculated totals verification)', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client: clientAUser.id,
        invoiceNumber: 'INV-2026-0001',
        dueDate: new Date(Date.now() + 86400000 * 14).toISOString(),
        taxRate: 10,
        discount: 50,
        currency: 'USD',
        status: 'pending',
        items: [
          { description: 'Cloud Architecture Consulting', quantity: 10, unitPrice: 150 }, // 1500
          { description: 'Security Audit & Compliance', quantity: 1, unitPrice: 500 },    // 500
        ],
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    // subtotal = 1500 + 500 = 2000
    // discount = 50 -> 1950
    // tax (10% of 1950) = 195
    // totalAmount = 1950 + 195 = 2145
    assert.equal(res.body.data.subtotal, 2000);
    assert.equal(res.body.data.taxAmount, 195);
    assert.equal(res.body.data.totalAmount, 2145);

    clientAInvoiceId = res.body.data._id;
  });

  test('Admin creates invoice for Client B', async () => {
    const res = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        client: clientBUser._id.toString(),
        invoiceNumber: 'INV-2026-0002',
        dueDate: new Date(Date.now() + 86400000 * 30).toISOString(),
        items: [
          { description: 'Enterprise Portal License', quantity: 1, unitPrice: 3500 },
        ],
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);

    clientBInvoiceId = res.body.data._id;
  });
});

describe('6. IDOR Prevention Tests (Critical)', () => {
  test('IDOR CHECK 1: Client A attempting to GET Client B invoice must return 403 Forbidden', async () => {
    const res = await request(app)
      .get(`/api/invoices/${clientBInvoiceId}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /permission to access invoices belonging to another account/i);
  });

  test('IDOR CHECK 2: Client A listing invoices must ONLY return Client A invoices', async () => {
    const res = await request(app)
      .get('/api/invoices')
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Must return Client A's invoice
    const invoiceIds = res.body.data.map((inv: any) => inv._id);
    assert.ok(invoiceIds.includes(clientAInvoiceId));
    // MUST NEVER return Client B's invoice!
    assert.ok(!invoiceIds.includes(clientBInvoiceId));
  });

  test('IDOR CHECK 3: Client A spoofing ?client=<ClientB_id> query must be overridden by server', async () => {
    const res = await request(app)
      .get(`/api/invoices?client=${clientBUser._id.toString()}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 200);
    // The server must ignore the injected client param and still only return Client A's invoices
    const invoiceIds = res.body.data.map((inv: any) => inv._id);
    assert.ok(!invoiceIds.includes(clientBInvoiceId));
    assert.ok(invoiceIds.includes(clientAInvoiceId));
  });

  test('Authorized Client A accessing their own invoice succeeds (200)', async () => {
    const res = await request(app)
      .get(`/api/invoices/${clientAInvoiceId}`)
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.invoiceNumber, 'INV-2026-0001');
  });

  test('Admin can access any client invoice (200)', async () => {
    const resA = await request(app)
      .get(`/api/invoices/${clientAInvoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resA.status, 200);

    const resB = await request(app)
      .get(`/api/invoices/${clientBInvoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(resB.status, 200);
  });
});

describe('7. Invoice Update, Status & Deletion Authorization', () => {
  test('Client cannot update their own invoice (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/invoices/${clientAInvoiceId}`)
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ notes: 'Client attempt to change invoice' });
    assert.equal(res.status, 403);
  });

  test('Client cannot update invoice status (403 Forbidden)', async () => {
    const res = await request(app)
      .patch(`/api/invoices/${clientAInvoiceId}/status`)
      .set('Authorization', `Bearer ${clientAToken}`)
      .send({ status: 'paid' });
    assert.equal(res.status, 403);
  });

  test('Staff can update invoice status to paid (200 OK)', async () => {
    const res = await request(app)
      .patch(`/api/invoices/${clientAInvoiceId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'paid' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, 'paid');
    assert.ok(res.body.data.paidAt);
  });

  test('Staff cannot delete invoice (financial record immutability - 403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/invoices/${clientBInvoiceId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    assert.equal(res.status, 403);
  });

  test('Admin can delete invoice (200 OK)', async () => {
    const res = await request(app)
      .delete(`/api/invoices/${clientBInvoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify it is gone
    const checkRes = await request(app)
      .get(`/api/invoices/${clientBInvoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(checkRes.status, 404);
  });
});

describe('8. Invoice Stats Aggregation Scoping', () => {
  test('Client stats are scoped exclusively to their own data', async () => {
    const res = await request(app)
      .get('/api/invoices/stats')
      .set('Authorization', `Bearer ${clientAToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.metrics.totalCount, 1);
    assert.equal(res.body.data.metrics.totalPaid, 2145);
  });

  test('Admin stats aggregate system-wide invoice metrics', async () => {
    const res = await request(app)
      .get('/api/invoices/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.metrics.totalCount, 1);
  });
});
