/**
 * Tier 3 — License Gating, Admin Pipeline, DB Persistence & COOP Routing
 * Tests T3-XF-07 to T3-XF-10
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
  getTestDatabaseState,
  TEST_DB_PATH,
} from '../helpers/test-context.mjs';

export const tests = [
  {
    id: 'T3-XF-07',
    feature: 'F2+F4',
    tier: 3,
    title: 'T3-XF-07: Free license cannot access Mode 2 without Creator license; Paddle Creator license unlocks Anti-SynthID Deep clean',
    async run() {
      setupTestDatabase();

      // 1. Inspect license features gating contract in useFFmpegCleaner.ts
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');
      assert.ok(
        cleanerSrc.includes('LicenseFeaturesGating'),
        'useFFmpegCleaner.ts must export LicenseFeaturesGating interface'
      );
      assert.ok(
        cleanerSrc.includes('modeDeepAntiSynthID'),
        'LicenseFeaturesGating must define modeDeepAntiSynthID gating flag'
      );
      assert.ok(
        cleanerSrc.includes("if (mode === 'deep' && !licenseFeatures?.modeDeepAntiSynthID)"),
        'useFFmpegCleaner.ts must enforce license check blocking Mode 2 without modeDeepAntiSynthID'
      );

      // 2. Call /api/verify-license with invalid key -> blocked
      const { POST: verifyLicensePost } = loadRoute('app/api/verify-license/route.ts');

      const invalidReq = createMockRequest('/api/verify-license', {
        method: 'POST',
        body: { licenseKey: 'INVALID-KEY-123' },
      });
      const invalidRes = await verifyLicensePost(invalidReq);
      const invalidData = await parseJsonResponse(invalidRes);
      assert.equal(invalidData.valid, false, 'Invalid license key must return valid: false');

      // 3. Call /api/verify-license with Creator dev mock / active license
      delete process.env.PADDLE_API_KEY;
      process.env.ALLOW_DEV_MOCK_KEYS = 'true';

      const validReq = createMockRequest('/api/verify-license', {
        method: 'POST',
        body: { licenseKey: 'MOCK-CREATOR-LICENSE' },
      });
      const validRes = await verifyLicensePost(validReq);
      const validData = await parseJsonResponse(validRes);

      assert.equal(validData.valid, true, 'Valid creator license must return valid: true');
      assert.equal(validData.plan, 'creator', 'Must resolve plan: creator');
      assert.ok(validData.features, 'Must return unlocked features object');
      assert.equal(validData.features.modeDeepAntiSynthID, true, 'Creator license must unlock modeDeepAntiSynthID');
      assert.equal(validData.features.unlimitedDuration, true, 'Creator license must unlock unlimitedDuration');

      // 4. Verify Mode 2 pipeline flags when unlocked
      const mode2ExecIdx = cleanerSrc.indexOf("} else if (mode === 'deep') {");
      assert.ok(mode2ExecIdx !== -1, 'Mode 2 deep clean execution block must exist in cleaner');
      const mode2ExecSrc = cleanerSrc.slice(mode2ExecIdx, cleanerSrc.indexOf("} else if (mode === 'spoofer') {"));

      assert.ok(mode2ExecSrc.includes("'-crf'") && mode2ExecSrc.includes("'18'"), 'Mode 2 must enforce CRF 18');
      assert.ok(mode2ExecSrc.includes('highpass=f=20,lowpass=f=19500'), 'Mode 2 must enforce acoustic filter');
      assert.ok(mode2ExecSrc.includes('filter_units=remove_types=6'), 'Mode 2 must remove SEI metadata');
      assert.ok(mode2ExecSrc.includes("'+bitexact'"), 'Mode 2 must enforce +bitexact');
      assert.ok(mode2ExecSrc.includes("'+faststart'"), 'Mode 2 must include +faststart movflag');
    },
  },

  {
    id: 'T3-XF-08',
    feature: 'F1+F4',
    tier: 3,
    title: 'T3-XF-08: Admin account negocios.axkarl@gmail.com unlocks Mode 3 Multi-Variant Spoofer (10 variants) with zero credit burn',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const adminEmail = 'negocios.axkarl@gmail.com';

      // 1. Create admin user
      const admin = await db.createUser({
        email: adminEmail,
        name: 'Carlos Admin',
        googleId: 'g_admin_super',
      });

      assert.equal(admin.role, 'admin', 'negocios.axkarl@gmail.com must have role: admin');
      assert.equal(admin.plan, 'unlimited', 'Admin must have plan: unlimited');
      assert.equal(admin.credits, 999999, 'Admin must have 999999 infinite credits');

      // 2. Query credit status
      const creditsInfo = await db.getUserCredits(admin.id);
      assert.equal(creditsInfo.isAdmin, true);
      assert.equal(creditsInfo.hasUnlimitedAccess, true);
      assert.equal(creditsInfo.credits, 999999);

      // 3. Inspect Mode 3 in useFFmpegCleaner.ts for 10 unique variant configurations
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');
      assert.ok(cleanerSrc.includes('cropSeeds'), 'Mode 3 must define cropSeeds array');

      // Verify cropSeeds has 10 distinct floating point micro-crops
      const cropSeedsMatch = cleanerSrc.match(/cropSeeds\s*=\s*\[([^\]]+)\]/);
      assert.ok(cropSeedsMatch, 'cropSeeds array must be defined');

      const seeds = cropSeedsMatch[1]
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));
      assert.equal(seeds.length, 10, 'cropSeeds must contain exactly 10 micro-crop seeds');

      const uniqueSeeds = new Set(seeds);
      assert.equal(uniqueSeeds.size, 10, 'All 10 crop seeds must be completely distinct');

      // Verify noise and brightness modulation per variant index
      assert.ok(cleanerSrc.includes('noise=alls='), 'Must modulate noise per variant index');
      assert.ok(cleanerSrc.includes('eq=brightness='), 'Must modulate brightness per variant index');

      // 4. Verify consume credit endpoint bypass for admin
      const sessionToken = createTestSessionToken(admin);
      const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');

      const consumeReq = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'spoofer', fileName: 'batch_test.mp4' },
      });

      const consumeRes = await consumePost(consumeReq);
      assert.equal(consumeRes.status, 200);

      const consumeData = await parseJsonResponse(consumeRes);
      assert.equal(consumeData.success, true);
      assert.equal(consumeData.bypassed, true, 'Admin processing must be bypassed without burning credits');
      assert.equal(consumeData.credits, 999999, 'Admin credits must remain 999999');

      // Confirm DB credits remain 999999
      const postCredits = await db.getUserCredits(admin.id);
      assert.equal(postCredits.credits, 999999);
    },
  },

  {
    id: 'T3-XF-09',
    feature: 'F1+F5',
    tier: 3,
    title: 'T3-XF-09: User credits and transactions persist across reloads and reconcile with signed st_entitlements cookie ledger',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const auth = loadModule('lib/auth.ts');
      const testEmail = `reconciliation-${Date.now()}@example.com`;

      // 1. Create user with 5 credits
      const user = await db.createUser({
        email: testEmail,
        name: 'Persistent User',
        credits: 5,
      });

      assert.equal(user.credits, 5);

      // Verify file written to disk
      assert.ok(fs.existsSync(TEST_DB_PATH), 'DB JSON file must exist on disk');
      let diskState = getTestDatabaseState();
      assert.ok(diskState.users[user.id], 'User must be recorded in disk file');
      assert.equal(diskState.users[user.id].credits, 5);

      // 2. Simulate Vercel serverless cold start: clear in-memory cache
      const globalObj = globalThis;
      globalObj.__socialtools_state = null;
      globalObj.__socialtools_db_state = null;

      // Re-read directly from disk via db function
      const rehydratedUser = await db.getUserById(user.id);
      assert.ok(rehydratedUser, 'User must rehydrate from disk following cold start');
      assert.equal(rehydratedUser.credits, 5, 'Credits must persist across cache invalidation');

      // 3. Dual-layer signed st_entitlements cookie ledger reconciliation
      // Simulate client presenting signed entitlements ledger with 12 credits (e.g. from prior serverless invocation)
      const entitlementsToken = auth.signEntitlements({
        sub: user.googleId || user.id,
        email: user.email,
        credits: 12,
        trialGranted: true,
        plan: 'free',
        processedTxIds: ['tx_serverless_prior_01'],
      });

      const parsedLedger = auth.verifyEntitlements(entitlementsToken);
      assert.ok(parsedLedger, 'Entitlements token must verify cleanly');

      // Reconcile user with signed cookie ledger
      const reconciledUser = await db.reconcileUserWithEntitlements(parsedLedger);
      assert.equal(reconciledUser.credits, 12, 'Local database balance must reconcile to 12 credits');

      // 4. Perform atomic credit deduction
      const deductRes = await db.deductCredit(user.id, 'Procesamiento post-reconciliación');
      assert.equal(deductRes.success, true);
      assert.equal(deductRes.remaining, 11);

      // Verify updated balance persisted to disk
      diskState = getTestDatabaseState();
      assert.equal(diskState.users[user.id].credits, 11, 'Disk state must show 11 credits');
    },
  },

  {
    id: 'T3-XF-10',
    feature: 'F4+F5',
    tier: 3,
    title: 'T3-XF-10: Cross-Origin-Opener-Policy enables WebAssembly SharedArrayBuffer on /(.*) while maintaining popups on /checkout and /api/auth',
    async run() {
      // 1. Inspect next.config.mjs configuration
      assert.ok(fs.existsSync('next.config.mjs'), 'next.config.mjs must exist');
      const nextConfig = loadModule('next.config.mjs');

      assert.ok(typeof nextConfig.headers === 'function', 'nextConfig must export an async headers() function');
      const headerRules = await nextConfig.headers();
      assert.ok(Array.isArray(headerRules), 'headers() must return an array of header rules');

      // Helper to find headers for a source pattern
      const findRule = (srcPattern) => headerRules.find((r) => r.source === srcPattern);

      // 2. Global rule for WebAssembly SharedArrayBuffer
      const globalRule = findRule('/(.*)');
      assert.ok(globalRule, 'Global header rule for /(.*) must be defined');

      const globalCoop = globalRule.headers.find((h) => h.key === 'Cross-Origin-Opener-Policy');
      const globalCoep = globalRule.headers.find((h) => h.key === 'Cross-Origin-Embedder-Policy');

      assert.ok(globalCoop, 'Global rule must set Cross-Origin-Opener-Policy');
      assert.equal(globalCoop.value, 'same-origin', 'Global COOP must be same-origin for SharedArrayBuffer');
      assert.ok(globalCoep, 'Global rule must set Cross-Origin-Embedder-Policy');
      assert.equal(globalCoep.value, 'require-corp', 'Global COEP must be require-corp for SharedArrayBuffer');

      // 3. Auth exemptions for Google OAuth redirects and popups
      const authRule = findRule('/api/auth/(.*)');
      assert.ok(authRule, 'Auth routes /api/auth/(.*) must have a dedicated exemption rule');

      const authCoop = authRule.headers.find((h) => h.key === 'Cross-Origin-Opener-Policy');
      const authCoep = authRule.headers.find((h) => h.key === 'Cross-Origin-Embedder-Policy');

      assert.equal(
        authCoop?.value,
        'same-origin-allow-popups',
        'Auth COOP must be same-origin-allow-popups to allow Google OAuth popups'
      );
      assert.equal(
        authCoep?.value,
        'unsafe-none',
        'Auth COEP must be unsafe-none to avoid blocking Google redirects'
      );

      // 4. Checkout exemptions for Paddle payment overlay
      const checkoutRule = findRule('/checkout');
      assert.ok(checkoutRule, 'Checkout route /checkout must have a dedicated exemption rule');

      const checkoutCoop = checkoutRule.headers.find((h) => h.key === 'Cross-Origin-Opener-Policy');
      const checkoutCoep = checkoutRule.headers.find((h) => h.key === 'Cross-Origin-Embedder-Policy');

      assert.equal(
        checkoutCoop?.value,
        'same-origin-allow-popups',
        'Checkout COOP must be same-origin-allow-popups for Paddle payment window'
      );
      assert.equal(
        checkoutCoep?.value,
        'unsafe-none',
        'Checkout COEP must be unsafe-none for Paddle overlay'
      );

      // 5. Legal route exemptions
      const legalWildcardRule = findRule('/legal/(.*)');
      const legalBaseRule = findRule('/legal');
      assert.ok(
        legalWildcardRule || legalBaseRule,
        'Legal routes must have an exemption rule for external Merchant of Record links'
      );
    },
  },
];
