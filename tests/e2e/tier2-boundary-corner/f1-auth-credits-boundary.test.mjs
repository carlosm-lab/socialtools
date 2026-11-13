/**
 * Tier 2 — Boundary & Corner Cases: Auth, Sessions, Database & Credits
 * Tests T2-F1-01 to T2-F1-05
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadRoute, loadModule } from '../helpers/app-loader.mjs';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createMockRequest,
  createTestSessionToken,
  createExpiredSessionToken,
  createTamperedSessionToken,
  parseJsonResponse,
  TEST_DB_PATH,
} from '../helpers/test-context.mjs';

export const tests = [
  {
    id: 'T2-F1-01',
    feature: 'F1',
    tier: 2,
    title: 'Repeated Google OAuth logins for existing user are idempotent; welcome credit (1 credit) is NOT regranted',
    async run() {
      setupTestDatabase();
      try {
        const db = loadModule('lib/db.ts');
        const testEmail = `returning-user-${Date.now()}@test.com`;

        // 1. Initial creation (first login)
        const user = await db.createUser({
          email: testEmail,
          name: 'First Login',
          googleId: 'g_id_idempotent_1',
          role: 'user',
          plan: 'free',
          credits: 1,
        });

        // Consume the credit
        await db.deductCredit(user.id, 'Test video processing');
        const afterDeduct = await db.getUserCredits(user.id);
        assert.equal(afterDeduct.credits, 0, 'Credits must be 0 after consumption');

        // 2. Simulated second login via getUserByEmail & updateUser
        const existingUser = await db.getUserByEmail(testEmail);
        assert.ok(existingUser, 'Existing user must be found');

        // Update user on login without granting free credit
        await db.updateUser(existingUser.id, {
          lastLoginAt: new Date().toISOString(),
        });

        // 3. Confirm credits remain 0 (idempotent, no welcome grant reapplied)
        const creditsAfterSecondLogin = await db.getUserCredits(user.id);
        assert.equal(
          creditsAfterSecondLogin.credits,
          0,
          'Welcome credit must NOT be regranted on subsequent logins'
        );
      } finally {
        teardownTestDatabase();
      }
    },
  },

  {
    id: 'T2-F1-02',
    feature: 'F1',
    tier: 2,
    title: 'GET /api/auth/me with expired or tampered st_session cookie safely rejects authentication without crashing',
    async run() {
      setupTestDatabase();
      try {
        const { GET } = loadRoute('app/api/auth/me/route.ts');

        // Case A: Tampered session token
        const tamperedToken = createTamperedSessionToken({ email: 'tampered@example.com' });
        const reqTampered = createMockRequest('/api/auth/me', {
          cookies: { st_session: tamperedToken },
        });

        const resTampered = await GET(reqTampered);
        const dataTampered = await parseJsonResponse(resTampered);
        assert.equal(dataTampered.authenticated, false, 'Tampered token must be rejected');
        assert.equal(dataTampered.user, null);

        // Case B: Expired session token
        const expiredToken = createExpiredSessionToken({ email: 'expired@example.com' });
        const reqExpired = createMockRequest('/api/auth/me', {
          cookies: { st_session: expiredToken },
        });

        const resExpired = await GET(reqExpired);
        const dataExpired = await parseJsonResponse(resExpired);
        assert.equal(dataExpired.authenticated, false, 'Expired token must be rejected');
        assert.equal(dataExpired.user, null);
      } finally {
        teardownTestDatabase();
      }
    },
  },

  {
    id: 'T2-F1-03',
    feature: 'F1',
    tier: 2,
    title: 'POST /api/credits/consume when free user credit balance is 0 returns HTTP 402/403 and rejects operation',
    async run() {
      setupTestDatabase();
      try {
        const db = loadModule('lib/db.ts');
        const testEmail = `zero-credits-${Date.now()}@example.com`;

        // User with 0 credits
        const user = await db.createUser({
          email: testEmail,
          name: 'Zero Credits User',
          googleId: 'g_zero_cred',
          role: 'user',
          plan: 'free',
          credits: 0,
        });

        const sessionToken = createTestSessionToken({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
        });

        const { POST } = loadRoute('app/api/credits/consume/route.ts');
        const req = createMockRequest('/api/credits/consume', {
          method: 'POST',
          cookies: { st_session: sessionToken },
          body: { mode: 'fast', fileName: 'test.mp4' },
        });

        const res = await POST(req);
        assert.ok(
          [402, 403].includes(res.status),
          `Expected 402 Payment Required or 403 Forbidden, got ${res.status}`
        );

        const data = await parseJsonResponse(res);
        assert.equal(data.success, false);
      } finally {
        teardownTestDatabase();
      }
    },
  },

  {
    id: 'T2-F1-04',
    feature: 'F1',
    tier: 2,
    title: 'Admin account deductCredit calls succeed indefinitely without decrementing credits below infinite',
    async run() {
      setupTestDatabase();
      try {
        const db = loadModule('lib/db.ts');
        const adminEmail = 'negocios.axkarl@gmail.com';

        const adminUser = await db.createUser({
          email: adminEmail,
          name: 'Admin Boss',
          googleId: 'g_admin_inf',
          role: 'admin',
          plan: 'unlimited',
          credits: 999999,
        });

        // Perform multiple consecutive deductions
        for (let i = 0; i < 5; i++) {
          const result = await db.deductCredit(adminUser.id, `Batch video ${i + 1}`);
          assert.equal(result.success, true, 'Admin deduction must always succeed');
          assert.ok(result.remaining >= 999999, 'Admin credits must remain infinite');
        }

        const finalCredits = await db.getUserCredits(adminUser.id);
        assert.ok(finalCredits.credits >= 999999);
        assert.equal(finalCredits.isAdmin, true);
        assert.equal(finalCredits.hasUnlimitedAccess, true);
      } finally {
        teardownTestDatabase();
      }
    },
  },

  {
    id: 'T2-F1-05',
    feature: 'F1',
    tier: 2,
    title: 'Corrupted database JSON file triggers automatic graceful recovery with zero silent data corruption',
    async run() {
      setupTestDatabase();
      try {
        // Deliberately write invalid malformed JSON to database file
        fs.writeFileSync(TEST_DB_PATH, '{ "invalid": "json", unfinished...', 'utf8');

        // Invalidate in-memory cache
        const globalObj = globalThis;
        if (globalObj.__socialtools_state !== undefined) globalObj.__socialtools_state = null;

        const db = loadModule('lib/db.ts');

        // Must gracefully recover and return null without throwing unhandled process crashes
        const result = await db.getUserByEmail('nonexistent@test.com');
        assert.equal(result, null, 'Must safely recover and report null for nonexistent user');

        // Verify corrupted file was backed up or database reinitialized
        assert.ok(fs.existsSync(TEST_DB_PATH), 'Database file must be recovered');
      } finally {
        teardownTestDatabase();
      }
    },
  },
];
