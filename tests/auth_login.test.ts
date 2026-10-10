import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/server/app.ts';
import { connectDB, disconnectDB } from '../src/server/config/db.ts';
import { User } from '../src/server/models/User.ts';

let mongoServer: MongoMemoryServer;
const app = createApp();

let adminUser: any;
let clientUser: any;

before(async () => {
  process.env.NODE_ENV = 'test';
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await connectDB(uri);

  await User.deleteMany({});

  // Seed verified test accounts
  adminUser = await User.create({
    name: 'Nexus Admin User',
    email: 'admin@nexus.com',
    password: 'AdminPass123!',
    role: 'admin',
    companyName: 'Nexus Corporate Technologies',
  });

  clientUser = await User.create({
    name: 'Acme Client User',
    email: 'client@nexus.com',
    password: 'ClientPass123!',
    role: 'client',
    companyName: 'Acme Corp',
  });
});

after(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('AUTHENTICATION & LOGIN WORKFLOW TESTS', () => {
  test('1. Valid Administrator login returns JWT, admin role, and HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexus.com', password: 'AdminPass123!' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.role, 'admin');
    assert.equal(res.body.user.email, 'admin@nexus.com');
    assert.ok(res.body.token);

    // Verify Set-Cookie header contains HttpOnly token cookie
    const cookies = res.headers['set-cookie'];
    assert.ok(cookies, 'Expected Set-Cookie header');
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
    assert.ok(tokenCookie, 'Expected token cookie');
    assert.match(tokenCookie, /HttpOnly/i);
  });

  test('2. Valid Client login returns JWT, client role, and HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@nexus.com', password: 'ClientPass123!' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.role, 'client');
    assert.equal(res.body.user.email, 'client@nexus.com');
    assert.ok(res.body.token);

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies);
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
    assert.ok(tokenCookie);
    assert.match(tokenCookie, /HttpOnly/i);
  });

  test('3. Login with incorrect password returns 401 Unauthorized with error message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexus.com', password: 'WrongPassword999!' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid email or password/i);
  });

  test('4. Login with non-existent email returns 401 Unauthorized with error message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'unknown@nobody.com', password: 'Password123!' });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /invalid email or password/i);
  });

  test('5. GET /api/auth/me retrieves current session via Bearer Token', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@nexus.com', password: 'ClientPass123!' });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.success, true);
    assert.equal(meRes.body.user.email, 'client@nexus.com');
    assert.equal(meRes.body.user.role, 'client');
  });

  test('6. GET /api/auth/me retrieves current session via HttpOnly cookie', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexus.com', password: 'AdminPass123!' });

    const cookies = loginRes.headers['set-cookie'];
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
    const cookieValue = tokenCookie.split(';')[0];

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookieValue);

    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.success, true);
    assert.equal(meRes.body.user.email, 'admin@nexus.com');
    assert.equal(meRes.body.user.role, 'admin');
  });

  test('7. GET /api/auth/me without token or cookie returns 401 Unauthorized', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test('8. POST /api/auth/logout clears authentication cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    const cookies = res.headers['set-cookie'];
    assert.ok(cookies);
    const tokenCookie = cookies.find((c: string) => c.startsWith('token='));
    assert.ok(tokenCookie);
    // Cookie cleared (max-age=0 or expires in past)
    assert.match(tokenCookie, /Expires=|Max-Age=0/i);
  });

  test('9. Role-based server guard: Client account receives 403 Forbidden on admin endpoint', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'client@nexus.com', password: 'ClientPass123!' });

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /forbidden/i);
  });

  test('10. Role-based server guard: Admin account accesses admin endpoint with 200 OK', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@nexus.com', password: 'AdminPass123!' });

    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });
});
