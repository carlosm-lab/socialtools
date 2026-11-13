/**
 * Tier 4 — Real-World Workload Journey 1: Creator Onboarding & Credit Depletion
 * Test T4-RW-01
 */

import assert from 'node:assert/strict';
import { loadRoute, loadModule, loadSourceFile } from '../helpers/app-loader.mjs';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createMockRequest,
  parseJsonResponse,
  parseResponseCookies,
  getTestDatabaseState,
} from '../helpers/test-context.mjs';
import { verifyBitexactPipeline } from '../helpers/ffmpeg-verifier.mjs';

export const tests = [
  {
    id: 'T4-RW-01',
    feature: 'F1+F4+F2',
    tier: 4,
    title: 'T4-RW-01: Creator onboarding journey: Google OAuth -> 1 free credit grant -> Mode 1 clean -> credit depletion -> 402 Payment Required block',
    async run() {
      setupTestDatabase();

      process.env.GOOGLE_CLIENT_ID = 'e2e-google-client-id-test.apps.googleusercontent.com';
      process.env.GOOGLE_CLIENT_SECRET = 'e2e-google-client-secret-test';

      const originalFetch = globalThis.fetch;
      const creatorEmail = `journey-creator-${Date.now()}@example.com`;
      const googleUid = `g_uid_${Date.now()}`;

      try {
        // Mock Google OAuth services
        globalThis.fetch = async (url) => {
          const urlStr = String(url);
          if (urlStr.includes('oauth2.googleapis.com/token')) {
            return new Response(
              JSON.stringify({
                access_token: 'mock_google_token_journey_01',
                id_token: 'mock_id_token_journey_01',
                token_type: 'Bearer',
                expires_in: 3600,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            );
          }
          if (urlStr.includes('googleapis.com/oauth2/v3/userinfo')) {
            return new Response(
              JSON.stringify({
                sub: googleUid,
                email: creatorEmail,
                name: 'Elena Creator',
                picture: 'https://lh3.googleusercontent.com/a/creator-avatar.png',
                email_verified: true,
              }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            );
          }
          return originalFetch(url);
        };

        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: Initiating Google OAuth Login
        // ─────────────────────────────────────────────────────────────────────
        const { GET: authGoogleGet } = loadRoute('app/api/auth/google/route.ts');
        const loginReq = createMockRequest('/api/auth/google?return_to=/');
        const loginRes = await authGoogleGet(loginReq);

        assert.ok([302, 307].includes(loginRes.status), 'OAuth initiation must return redirect status');
        const redirectLocation = loginRes.headers.get('location');
        assert.ok(redirectLocation?.includes('accounts.google.com/o/oauth2/v2/auth'));

        const initCookies = parseResponseCookies(loginRes);
        assert.ok(initCookies['st_oauth_state'], 'OAuth state cookie must be set');
        const stateToken = initCookies['st_oauth_state'].value;

        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: Google OAuth Callback & Welcome Credit Grant
        // ─────────────────────────────────────────────────────────────────────
        const { GET: callbackGet } = loadRoute('app/api/auth/callback/google/route.ts');
        const callbackReq = createMockRequest(
          `/api/auth/callback/google?code=valid_auth_code_e2e&state=${stateToken}`,
          {
            cookies: {
              st_oauth_state: stateToken,
            },
          }
        );

        const callbackRes = await callbackGet(callbackReq);
        assert.ok([302, 307].includes(callbackRes.status), 'OAuth callback must redirect user to destination');

        const callbackCookies = parseResponseCookies(callbackRes);
        assert.ok(callbackCookies['st_session'], 'st_session cookie must be created');
        const sessionToken = callbackCookies['st_session'].value;

        // Verify Database state: User created with exactly 1 welcome credit
        const dbState = getTestDatabaseState();
        const userEntries = Object.values(dbState.users);
        const createdUser = userEntries.find((u) => u.email === creatorEmail.toLowerCase());

        assert.ok(createdUser, 'User record must exist in database');
        assert.equal(createdUser.credits, 1, 'New creator account must receive exactly 1 free credit');
        assert.equal(createdUser.plan, 'free', 'Initial plan must be free');

        const freeGrantTx = dbState.transactions.find(
          (t) => t.userId === createdUser.id && t.type === 'free_grant'
        );
        assert.ok(freeGrantTx, 'Initial free_grant transaction must be recorded in ledger');
        assert.equal(freeGrantTx.amount, 1);
        assert.equal(freeGrantTx.balanceAfter, 1);

        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: Client Inquires Session Balance (/api/auth/me)
        // ─────────────────────────────────────────────────────────────────────
        const { GET: authMeGet } = loadRoute('app/api/auth/me/route.ts');
        const meReq = createMockRequest('/api/auth/me', {
          cookies: {
            st_session: sessionToken,
          },
        });

        const meRes = await authMeGet(meReq);
        assert.equal(meRes.status, 200);
        const meData = await parseJsonResponse(meRes);

        assert.equal(meData.authenticated, true);
        assert.equal(meData.user.email, creatorEmail.toLowerCase());
        assert.equal(meData.user.credits, 1, 'Profile endpoint must report 1 available credit');
        assert.equal(meData.user.plan, 'free');

        // ─────────────────────────────────────────────────────────────────────
        // STEP 4: Creator Executes Mode 1 Fast Clean & Consumes 1 Credit
        // ─────────────────────────────────────────────────────────────────────
        // Verify cleaner pipeline uses bitexact arguments
        const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');
        const bitexactValid =
          cleanerSrc.includes("'-map'") &&
          cleanerSrc.includes("'0:v:0'") &&
          cleanerSrc.includes("'-map_metadata'") &&
          cleanerSrc.includes("'filter_units=remove_types=6'") &&
          cleanerSrc.includes("'+bitexact'") &&
          cleanerSrc.includes("'-metadata:s:v:0'") &&
          cleanerSrc.includes("'encoder='");
        assert.ok(bitexactValid, 'Mode 1 must use bitexact flags to eliminate XMP/EXIF and SEI tags');

        // Consume 1 credit via API
        const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');
        const consumeReq1 = createMockRequest('/api/credits/consume', {
          method: 'POST',
          cookies: {
            st_session: sessionToken,
          },
          body: {
            mode: 'fast',
            fileName: 'first_creator_reel.mp4',
            videoDuration: 18,
          },
        });

        const consumeRes1 = await consumePost(consumeReq1);
        assert.equal(consumeRes1.status, 200, 'First video processing must consume welcome credit');
        const consumeData1 = await parseJsonResponse(consumeRes1);

        assert.equal(consumeData1.success, true);
        assert.equal(consumeData1.bypassed, false);
        assert.equal(consumeData1.deducted, 1);
        assert.equal(consumeData1.credits, 0, 'Balance must drop to 0 after first clean');

        // Verify DB update
        const db = loadModule('lib/db.ts');
        const updatedCredits = await db.getUserCredits(createdUser.id);
        assert.equal(updatedCredits.credits, 0);

        // ─────────────────────────────────────────────────────────────────────
        // STEP 5: Creator Attempts Second Clean with 0 Credits -> HTTP 402 Block
        // ─────────────────────────────────────────────────────────────────────
        const consumeReq2 = createMockRequest('/api/credits/consume', {
          method: 'POST',
          cookies: {
            st_session: sessionToken,
          },
          body: {
            mode: 'fast',
            fileName: 'second_creator_reel.mp4',
            videoDuration: 22,
          },
        });

        const consumeRes2 = await consumePost(consumeReq2);
        assert.equal(consumeRes2.status, 402, 'Second video processing must be blocked with HTTP 402 Payment Required');
        const consumeData2 = await parseJsonResponse(consumeRes2);

        assert.equal(consumeData2.success, false);
        assert.equal(consumeData2.credits, 0);
        assert.ok(
          consumeData2.error.includes('Saldo') || consumeData2.error.includes('créditos'),
          'Error message must indicate insufficient credits'
        );

        // ─────────────────────────────────────────────────────────────────────
        // STEP 6: UI Redirect / Pricing Prompt Contract
        // ─────────────────────────────────────────────────────────────────────
        const pageSrc = loadSourceFile('app/page.tsx');
        assert.ok(
          pageSrc.includes('planes') || pageSrc.includes('/checkout'),
          'Page logic must direct users with insufficient credits to pricing options'
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    },
  },
];
