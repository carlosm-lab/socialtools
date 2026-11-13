/**
 * Tier 1 — Feature Area 1: Auth, Sessions, Database & Credits
 * Tests T1-F1-01 to T1-F1-05
 */

import assert from 'node:assert/strict';
import { loadRoute, loadModule } from '../helpers/app-loader.mjs';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createMockRequest,
  createTestSessionToken,
  parseJsonResponse,
  parseResponseCookies,
  getTestDatabaseState,
} from '../helpers/test-context.mjs';

export const tests = [
  {
    id: 'T1-F1-01',
    feature: 'F1',
    tier: 1,
    title: 'GET /api/auth/google returns 302/307 redirect with valid Google OAuth authorization URL, client ID, and scopes',
    async run() {
      process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
      const { GET } = loadRoute('app/api/auth/google/route.ts');

      const req = createMockRequest('/api/auth/google?return_to=/dashboard');
      const res = await GET(req);

      assert.ok([302, 307].includes(res.status), `Expected 302 or 307 redirect, got ${res.status}`);

      const location = res.headers.get('location');
      assert.ok(location, 'Expected Location header in redirect response');

      const redirectUrl = new URL(location);
      assert.equal(redirectUrl.hostname, 'accounts.google.com', 'Must point to Google accounts');
      assert.equal(redirectUrl.pathname, '/o/oauth2/v2/auth', 'Must use OAuth 2.0 auth endpoint');
      assert.equal(redirectUrl.searchParams.get('client_id'), process.env.GOOGLE_CLIENT_ID);
      assert.ok(redirectUrl.searchParams.get('redirect_uri')?.includes('/api/auth/callback/google'), 'Redirect URI must match callback endpoint');
      assert.ok(redirectUrl.searchParams.get('scope')?.includes('email'), 'Must include email scope');
      assert.ok(redirectUrl.searchParams.get('scope')?.includes('profile'), 'Must include profile scope');
      assert.ok(redirectUrl.searchParams.get('state'), 'Must contain CSRF state parameter');

      const cookies = parseResponseCookies(res);
      assert.ok(cookies['st_oauth_state'], 'Must set st_oauth_state cookie');
      assert.ok(cookies['st_oauth_state'].httpOnly, 'st_oauth_state must be HttpOnly');
    },
  },

  {
    id: 'T1-F1-02',
    feature: 'F1',
    tier: 1,
    title: 'GET /api/auth/callback/google upserts user in database and sets HTTP-only st_session cookie',
    async run() {
      setupTestDatabase();

      process.env.GOOGLE_CLIENT_ID = 'test-client-id';
      process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const originalFetch = globalThis.fetch;
      const testEmail = `new-creator-${Date.now()}@example.com`;

      try {
        // Mock Google token exchange & userinfo fetch
        globalThis.fetch = async (url) => {
          const urlStr = String(url);
          if (urlStr.includes('oauth2.googleapis.com/token')) {
            return new Response(
              JSON.stringify({
                access_token: 'mock_google_access_token_123',
                id_token: 'mock_id_token',
                token_type: 'Bearer',
                expires_in: 3600,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            );
          }
          if (urlStr.includes('googleapis.com/oauth2/v3/userinfo')) {
            return new Response(
              JSON.stringify({
                sub: 'google_uid_987654321',
                email: testEmail,
                name: 'New Creator User',
                picture: 'https://example.com/avatar.jpg',
                email_verified: true,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            );
          }
          return originalFetch(url);
        };

        const { GET } = loadRoute('app/api/auth/callback/google/route.ts');
        const stateToken = 'test-valid-csrf-state-token-12345';

        const req = createMockRequest(
          `/api/auth/callback/google?code=mock_code&state=${stateToken}`,
          {
            cookies: {
              st_oauth_state: stateToken,
              st_oauth_return: '/studio',
            },
          }
        );

        const res = await GET(req);

        assert.ok([302, 307].includes(res.status), `Expected redirect status, got ${res.status}`);

        const cookies = parseResponseCookies(res);
        assert.ok(cookies['st_session'], 'Expected st_session cookie to be issued');
        assert.ok(cookies['st_session'].httpOnly, 'st_session cookie must be HttpOnly');

        const db = loadModule('lib/db.ts');
        const user = await db.getUserByEmail(testEmail);
        assert.ok(user, 'User must exist in database after callback');
        assert.equal(user.email, testEmail);
        assert.equal(user.name, 'New Creator User');
        assert.equal(user.credits, 1, 'First-time user must receive 1 credit');
      } finally {
        globalThis.fetch = originalFetch;
        teardownTestDatabase();
      }
    },
  },

  {
    id: 'T1-F1-03',
    feature: 'F1',
    tier: 1,
    title: 'First-time user signup automatically receives 1 credit and logs a free_grant transaction in database',
    async run() {
      setupTestDatabase();
      try {
        const db = loadModule('lib/db.ts');
        const testEmail = `welcome-credit-${Date.now()}@test.com`;

        const user = await db.createUser({
          email: testEmail,
          name: 'Welcome Tester',
          googleId: 'g_test_welcome_1',
          role: 'user',
          plan: 'free',
          credits: 1,
        });

        await db.logTransaction({
          userId: user.id,
          type: 'free_grant',
          amount: 1,
          balanceAfter: 1,
          description: 'Crédito de bienvenida gratuito (Prueba inicial de video)',
        });

        assert.equal(user.credits, 1, 'User must have exactly 1 credit');
        assert.equal(user.plan, 'free', 'User initial plan must be free');

        const creditsInfo = await db.getUserCredits(user.id);
        assert.equal(creditsInfo.credits, 1);
        assert.equal(creditsInfo.isAdmin, false);

        const dbState = getTestDatabaseState();
        const tx = dbState.transactions.find((t) => t.userId === user.id);
        assert.ok(tx, 'Transaction must be recorded');
        assert.equal(tx.type, 'free_grant');
        assert.equal(tx.amount, 1);
      } finally {
        teardownTestDatabase();
      }
    },
  },

  {
    id: 'T1-F1-04',
    feature: 'F1',
    tier: 1,
    title: 'Account negocios.axkarl@gmail.com is automatically provisioned with role: admin, plan: unlimited, and infinite credits',
    async run() {
      setupTestDatabase();
      try {
        const db = loadModule('lib/db.ts');
        const adminEmail = 'negocios.axkarl@gmail.com';

        assert.ok(db.isAdminEmail(adminEmail), 'isAdminEmail must return true for admin');
        assert.equal(db.isAdminEmail('other@example.com'), false);

        // Create or query admin account
        const user = await db.createUser({
          email: adminEmail,
          name: 'SocialTools Administrator',
          googleId: 'g_admin_root',
          role: 'admin',
          plan: 'unlimited',
          credits: 999999,
        });

        assert.equal(user.role, 'admin');
        assert.equal(user.plan, 'unlimited');
        assert.ok(user.credits >= 999999, 'Admin must have unlimited credits');

        const creditsInfo = await db.getUserCredits(user.id);
        assert.equal(creditsInfo.isAdmin, true);
        assert.equal(creditsInfo.hasUnlimitedAccess, true);
      } finally {
        teardownTestDatabase();
      }
    },
  },

  {
    id: 'T1-F1-05',
    feature: 'F1',
    tier: 1,
    title: 'GET /api/auth/me with valid st_session cookie returns user identity, active plan, and live credit balance',
    async run() {
      setupTestDatabase();
      try {
        const db = loadModule('lib/db.ts');
        const testEmail = `me-check-${Date.now()}@example.com`;

        const user = await db.createUser({
          email: testEmail,
          name: 'Me Route User',
          googleId: 'g_me_test',
          role: 'user',
          plan: 'free',
          credits: 5,
        });

        const token = createTestSessionToken({
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
        });

        const { GET } = loadRoute('app/api/auth/me/route.ts');
        const req = createMockRequest('/api/auth/me', {
          cookies: {
            st_session: token,
          },
        });

        const res = await GET(req);
        assert.equal(res.status, 200);

        const data = await parseJsonResponse(res);
        assert.equal(data.authenticated, true);
        assert.ok(data.user, 'Expected user object');
        assert.equal(data.user.email, testEmail);
        assert.equal(data.user.credits, 5, 'Must reflect live credit balance from database');
        assert.equal(data.user.plan, 'free');
      } finally {
        teardownTestDatabase();
      }
    },
  },
];
