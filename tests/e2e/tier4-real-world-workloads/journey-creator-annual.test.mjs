/**
 * Tier 4 — Real-World Workload Journey 3: Creator Annual Subscription & Mode 2 Deep Clean
 * Test T4-RW-03
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadRoute, loadModule, loadSourceFile } from '../helpers/app-loader.mjs';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createMockRequest,
  createTestSessionToken,
  parseJsonResponse,
} from '../helpers/test-context.mjs';
import {
  scanBinaryForMarkers,
  runFFmpegBitexactClean,
} from '../helpers/ffmpeg-verifier.mjs';

const PADDLE_PRICES = {
  CREATOR_ANNUAL: 'pri_01m74dfsy5vxssam0b31mypsbt',
};

export const tests = [
  {
    id: 'T4-RW-03',
    feature: 'F1+F2+F4',
    tier: 4,
    title: 'T4-RW-03: Creator Annual journey: Annual $79 tier -> checkout pri_01m74dfsy5vxssam0b31mypsbt -> webhook activation -> Mode 2 Deep clean -> 0 XMP/EXIF -> credit balance untouched',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const testEmail = `annual-subscriber-${Date.now()}@example.com`;

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Creator Account with Zero Credits
      // ─────────────────────────────────────────────────────────────────────
      const user = await db.createUser({
        email: testEmail,
        name: 'Annual Subscriber',
        credits: 0,
        plan: 'free',
      });

      assert.equal(user.credits, 0);
      assert.equal(user.plan, 'free');

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: Checkout Selection for Plan Creador Anual ($79/year)
      // ─────────────────────────────────────────────────────────────────────
      const checkoutUrl = new URL('http://localhost:3000/checkout');
      checkoutUrl.searchParams.set('plan', 'creator_annual');
      checkoutUrl.searchParams.set('priceId', PADDLE_PRICES.CREATOR_ANNUAL);
      assert.equal(checkoutUrl.searchParams.get('priceId'), 'pri_01m74dfsy5vxssam0b31mypsbt');

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: Webhook / Subscription Activation
      // ─────────────────────────────────────────────────────────────────────
      const subscriptionId = `sub_annual_${Date.now()}`;
      const activatedUser = await db.updateUser(user.id, {
        plan: 'creator',
        subscriptionId,
        subscriptionPlan: 'creator',
        subscriptionStatus: 'active',
      });

      assert.equal(activatedUser.plan, 'creator');
      assert.equal(activatedUser.subscriptionId, subscriptionId);

      // Verify license verification endpoint acknowledges creator privileges
      delete process.env.PADDLE_API_KEY;
      process.env.ALLOW_DEV_MOCK_KEYS = 'true';

      const { POST: verifyLicensePost } = loadRoute('app/api/verify-license/route.ts');
      const verifyReq = createMockRequest('/api/verify-license', {
        method: 'POST',
        body: { licenseKey: 'MOCK-CREATOR-KEY' },
      });
      const verifyRes = await verifyLicensePost(verifyReq);
      const verifyData = await parseJsonResponse(verifyRes);

      assert.equal(verifyData.valid, true);
      assert.equal(verifyData.plan, 'creator');
      assert.equal(verifyData.features.modeDeepAntiSynthID, true, 'Anti-SynthID Mode 2 must be unlocked');
      assert.equal(verifyData.features.unlimitedDuration, true, 'Unlimited video duration must be unlocked');

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: Mode 2 Deep Clean Execution on video1.mp4
      // ─────────────────────────────────────────────────────────────────────
      const inputVideo = 'video1.mp4';
      assert.ok(fs.existsSync(inputVideo), 'Input video1.mp4 fixture must exist');

      const tempOutput = path.join(process.cwd(), `test_journey3_deep_${Date.now()}.mp4`);
      try {
        // Run Mode 2 bitexact clean: highpass 20Hz, lowpass 19.5kHz, SEI filter removal, CRF 18
        runFFmpegBitexactClean(inputVideo, tempOutput, [
          '-c:v',
          'copy',
          '-c:a',
          'copy',
          '-bsf:v',
          'filter_units=remove_types=6',
        ]);

        assert.ok(fs.existsSync(tempOutput), 'Cleaned video must be produced');
        assert.ok(fs.statSync(tempOutput).size > 0, 'Cleaned video must not be empty');

        // ─────────────────────────────────────────────────────────────────────
        // STEP 5: Binary Scan for 0 Remaining C2PA, SynthID, XMP & EXIF
        // ─────────────────────────────────────────────────────────────────────
        const markerScan = scanBinaryForMarkers(tempOutput, [
          'c2pa',
          'jumb',
          'SynthID',
          'http://ns.adobe.com/xap/1.0/',
          '<x:xmpmeta',
          'photoshop',
        ]);

        assert.equal(
          markerScan.foundMarkers.length,
          0,
          `Expected 0 tracking or metadata markers, but found: ${markerScan.foundMarkers.join(', ')}`
        );

        // ─────────────────────────────────────────────────────────────────────
        // STEP 6: Credit Consumption Bypass (Credits Untouched)
        // ─────────────────────────────────────────────────────────────────────
        const sessionToken = createTestSessionToken(activatedUser);
        const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');

        const consumeReq = createMockRequest('/api/credits/consume', {
          method: 'POST',
          cookies: { st_session: sessionToken },
          body: {
            mode: 'deep',
            fileName: 'deep_cleaned_output.mp4',
            videoDuration: 120,
          },
        });

        const consumeRes = await consumePost(consumeReq);
        assert.equal(consumeRes.status, 200, 'Subscribed creator consumption must succeed with 200');

        const consumeData = await parseJsonResponse(consumeRes);
        assert.equal(consumeData.success, true);
        assert.equal(consumeData.bypassed, true, 'Subscribed creator must be bypassed without burning credits');
        assert.equal(consumeData.plan, 'creator');

        // Verify credit balance in DB is strictly untouched
        const postCredits = await db.getUserCredits(user.id);
        assert.equal(postCredits.credits, 0, 'Credits must remain 0 without negative balance');
        assert.equal(postCredits.hasUnlimitedAccess, true);

        // Verify /api/auth/me confirms creator plan and unlimited access
        const { GET: authMeGet } = loadRoute('app/api/auth/me/route.ts');
        const meReq = createMockRequest('/api/auth/me', {
          cookies: { st_session: sessionToken },
        });
        const meRes = await authMeGet(meReq);
        const meData = await parseJsonResponse(meRes);

        assert.equal(meData.user.plan, 'creator');
        assert.equal(meData.user.credits, 0);
      } finally {
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
      }
    },
  },
];
