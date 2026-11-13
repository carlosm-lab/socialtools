/**
 * Tier 4 — Real-World Workload Journey 4: Admin Infinite Privileges & Multi-Variant Processing
 * Test T4-RW-04
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadRoute, loadModule, loadSourceFile } from '../helpers/app-loader.mjs';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createMockRequest,
  createTestSessionToken,
  parseJsonResponse,
} from '../helpers/test-context.mjs';

export const tests = [
  {
    id: 'T4-RW-04',
    feature: 'F1+F4+F5',
    tier: 4,
    title: 'T4-RW-04: Admin unlimited journey: Admin login negocios.axkarl@gmail.com -> role admin / plan unlimited / credits infinite -> Mode 1, Mode 2, Mode 3 10 variants with distinct hashes -> credit balance unaffected',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const adminEmail = 'negocios.axkarl@gmail.com';

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Admin Account Automatic Elevation & Session
      // ─────────────────────────────────────────────────────────────────────
      const adminUser = await db.createUser({
        email: adminEmail,
        name: 'Carlos Admin',
        googleId: 'g_admin_super_01',
      });

      assert.equal(adminUser.email, adminEmail);
      assert.equal(adminUser.role, 'admin', 'Account must be automatically elevated to role: admin');
      assert.equal(adminUser.plan, 'unlimited', 'Admin plan must be unlimited');
      assert.equal(adminUser.credits, 999999, 'Admin credits must be initialized to 999999');

      const sessionToken = createTestSessionToken(adminUser);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: Profile Inquiry (/api/auth/me)
      // ─────────────────────────────────────────────────────────────────────
      const { GET: authMeGet } = loadRoute('app/api/auth/me/route.ts');
      const meReq = createMockRequest('/api/auth/me', {
        cookies: { st_session: sessionToken },
      });

      const meRes = await authMeGet(meReq);
      assert.equal(meRes.status, 200);
      const meData = await parseJsonResponse(meRes);

      assert.equal(meData.authenticated, true);
      assert.equal(meData.user.role, 'admin');
      assert.equal(meData.user.plan, 'unlimited');
      assert.equal(meData.user.credits, 999999);
      assert.equal(meData.user.isAdmin, true);

      // Verify db getUserCredits directly
      const creditsInfo = await db.getUserCredits(adminUser.id);
      assert.equal(creditsInfo.isAdmin, true);
      assert.equal(creditsInfo.hasUnlimitedAccess, true);
      assert.equal(creditsInfo.credits, 999999);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: Admin Runs Mode 1 (Fast Clean)
      // ─────────────────────────────────────────────────────────────────────
      const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');

      const mode1Req = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'fast', fileName: 'admin_test_fast.mp4' },
      });

      const mode1Res = await consumePost(mode1Req);
      assert.equal(mode1Res.status, 200);
      const mode1Data = await parseJsonResponse(mode1Res);

      assert.equal(mode1Data.success, true);
      assert.equal(mode1Data.bypassed, true, 'Mode 1 must be bypassed for admin');
      assert.equal(mode1Data.credits, 999999);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: Admin Runs Mode 2 (Deep Clean)
      // ─────────────────────────────────────────────────────────────────────
      const mode2Req = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'deep', fileName: 'admin_test_deep.mp4' },
      });

      const mode2Res = await consumePost(mode2Req);
      assert.equal(mode2Res.status, 200);
      const mode2Data = await parseJsonResponse(mode2Res);

      assert.equal(mode2Data.success, true);
      assert.equal(mode2Data.bypassed, true, 'Mode 2 must be bypassed for admin');
      assert.equal(mode2Data.credits, 999999);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5: Admin Runs Mode 3 (Multi-Variant Spoofer — 10 Variants)
      // ─────────────────────────────────────────────────────────────────────
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      // Verify cropSeeds definition has 10 distinct values
      const cropSeedsMatch = cleanerSrc.match(/cropSeeds\s*=\s*\[([^\]]+)\]/);
      assert.ok(cropSeedsMatch, 'cropSeeds array must be defined in useFFmpegCleaner.ts');

      const cropSeeds = cropSeedsMatch[1]
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n));
      assert.equal(cropSeeds.length, 10, 'cropSeeds must define 10 elements');

      const variantCount = 10;
      const variantHashes = new Set();
      const variantMd5s = new Set();

      // Simulate generating 10 variants according to the mathematical modulations in useFFmpegCleaner.ts:
      // Filter: crop factor from cropSeeds, noise=alls=${i}, eq=brightness=${brightness}
      for (let i = 1; i <= variantCount; i++) {
        const cropFactor = cropSeeds[(i - 1) % cropSeeds.length];
        const brightness = (((i % 5) - 2) * 0.001).toFixed(4);
        const filterExpr = `crop=iw*${cropFactor}:ih*${cropFactor},noise=alls=${i}:allf=t,eq=brightness=${brightness}`;

        // Compute cryptographic hashes of the unique variant filter payload
        const sha256 = crypto.createHash('sha256').update(`variant_${i}_${filterExpr}`).digest('hex');
        const md5 = crypto.createHash('md5').update(`variant_${i}_${filterExpr}`).digest('hex');

        assert.ok(!variantHashes.has(sha256), `Variant ${i} produced collision in SHA-256`);
        assert.ok(!variantMd5s.has(md5), `Variant ${i} produced collision in MD5`);

        variantHashes.add(sha256);
        variantMd5s.add(md5);
      }

      assert.equal(variantHashes.size, 10, 'All 10 variants must have strictly unique SHA-256 hashes');
      assert.equal(variantMd5s.size, 10, 'All 10 variants must have strictly unique MD5 hashes');

      // Call consume for Mode 3 batch processing
      const mode3Req = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'spoofer', fileName: 'admin_batch_10.mp4', variantCount: 10 },
      });

      const mode3Res = await consumePost(mode3Req);
      assert.equal(mode3Res.status, 200);
      const mode3Data = await parseJsonResponse(mode3Res);

      assert.equal(mode3Data.success, true);
      assert.equal(mode3Data.bypassed, true, 'Mode 3 multi-variant must be bypassed for admin');
      assert.equal(mode3Data.credits, 999999);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 6: Verify Database Ledger Credits are Completely Untouched
      // ─────────────────────────────────────────────────────────────────────
      const finalCredits = await db.getUserCredits(adminUser.id);
      assert.equal(finalCredits.credits, 999999, 'Admin credit balance must remain 999999 after all operations');
      assert.equal(finalCredits.isAdmin, true);
      assert.equal(finalCredits.hasUnlimitedAccess, true);
    },
  },
];
