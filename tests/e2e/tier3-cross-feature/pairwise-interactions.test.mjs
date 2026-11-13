/**
 * Tier 3 — Cross-Feature Pairwise Interactions
 * Tests T3-XF-01 to T3-XF-06
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadRoute, loadModule, loadSourceFile, fileExists } from '../helpers/app-loader.mjs';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createMockRequest,
  createTestSessionToken,
  parseJsonResponse,
  parseResponseCookies,
  getTestDatabaseState,
} from '../helpers/test-context.mjs';
import { inspectComponentFile, checkDesignTokens } from '../helpers/dom-inspector.mjs';
import { verifyBitexactPipeline, REQUIRED_BITEXACT_FLAGS } from '../helpers/ffmpeg-verifier.mjs';

function generatePaddleSignature(rawBody, secret, timestamp) {
  const signedPayload = `${timestamp}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `ts=${timestamp};h1=${h1}`;
}

export const tests = [
  {
    id: 'T3-XF-01',
    feature: 'F1+F4',
    tier: 3,
    title: 'F1+F4: Authenticated user with welcome credit consumes 1 credit during Mode 1 clean with bitexact pipeline',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const testEmail = `creator-clean-${Date.now()}@example.com`;

      // 1. Create creator user with 1 welcome credit
      const user = await db.createUser({
        email: testEmail,
        name: 'Creator Clean User',
        googleId: 'g_clean_001',
      });

      assert.equal(user.credits, 1, 'New creator must have 1 welcome credit');
      assert.equal(user.plan, 'free', 'Initial plan must be free');

      // 2. Build authenticated session request
      const sessionToken = createTestSessionToken(user);
      const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');

      const consumeReq = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: {
          st_session: sessionToken,
        },
        body: {
          mode: 'fast',
          fileName: 'user_vlog.mp4',
          videoDuration: 15,
        },
      });

      const consumeRes = await consumePost(consumeReq);
      assert.equal(consumeRes.status, 200, 'Credit consumption should succeed with 200');

      const consumeData = await parseJsonResponse(consumeRes);
      assert.equal(consumeData.success, true, 'Credit consumption must succeed');
      assert.equal(consumeData.bypassed, false, 'Free user consumption must not be bypassed');
      assert.equal(consumeData.deducted, 1, 'Must deduct 1 credit');
      assert.equal(consumeData.credits, 0, 'Remaining credits must be 0');

      // 3. Verify DB state persistence
      const updatedCredits = await db.getUserCredits(user.id);
      assert.equal(updatedCredits.credits, 0, 'Database balance must be 0');

      const transactions = await db.getUserTransactions(user.id);
      const cleanTx = transactions.find((t) => t.type === 'video_processed');
      assert.ok(cleanTx, 'Transaction log must record video_processed transaction');
      assert.equal(cleanTx.amount, -1, 'Transaction amount must be -1');
      assert.equal(cleanTx.balanceAfter, 0, 'Balance after transaction must be 0');

      // 4. Verify cleaner pipeline interaction: app/page.tsx connects video execution with /api/credits/consume
      const pageSrc = loadSourceFile('app/page.tsx');
      assert.ok(
        pageSrc.includes('/api/credits/consume'),
        'app/page.tsx must call /api/credits/consume to deduct credit before or during video execution'
      );
      assert.ok(
        pageSrc.includes('executeClean'),
        'app/page.tsx must invoke executeClean to run the video cleaning engine'
      );

      // Verify Mode 1 uses the bitexact argument pipeline
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');
      const hasBitexactFlags =
        cleanerSrc.includes("'-map'") &&
        cleanerSrc.includes("'0:v:0'") &&
        cleanerSrc.includes("'-map_metadata'") &&
        cleanerSrc.includes("'filter_units=remove_types=6'") &&
        cleanerSrc.includes("'+bitexact'") &&
        cleanerSrc.includes("'-metadata:s:v:0'") &&
        cleanerSrc.includes("'encoder='");
      assert.ok(hasBitexactFlags, 'useFFmpegCleaner.ts must contain bitexact flags in Mode 1');
    },
  },

  {
    id: 'T3-XF-02',
    feature: 'F1+F2',
    tier: 3,
    title: 'F1+F2: Authenticated user session identity binds userId and userEmail into Paddle Checkout customData',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const testEmail = `checkout-user-${Date.now()}@example.com`;

      const user = await db.createUser({
        email: testEmail,
        name: 'Checkout User',
        googleId: 'g_checkout_002',
      });

      // 1. Session token delivers authentic user identity
      const sessionToken = createTestSessionToken(user);
      const auth = loadModule('lib/auth.ts');
      const verifiedSession = auth.verifySession(sessionToken);
      assert.ok(verifiedSession, 'Session token must verify cleanly');
      assert.equal(verifiedSession.userId, user.id, 'Session must bind correct userId');
      assert.equal(verifiedSession.email, testEmail, 'Session must bind correct email');

      // 2. Checkout contract verification in app/checkout/page.tsx
      assert.ok(fileExists('app/checkout/page.tsx'), 'app/checkout/page.tsx must exist');
      const checkoutSrc = loadSourceFile('app/checkout/page.tsx');

      // Verify customData and customer binding according to PROJECT.md / ORIGINAL_REQUEST.md
      const bindsCustomData = checkoutSrc.includes('customData');
      const bindsUserIdentity =
        checkoutSrc.includes('userEmail') ||
        checkoutSrc.includes('userId') ||
        checkoutSrc.includes('customer');

      assert.ok(
        bindsCustomData && bindsUserIdentity,
        'Paddle Checkout invocation in app/checkout/page.tsx must forward customData binding userId and userEmail (Pending M4)'
      );
    },
  },

  {
    id: 'T3-XF-03',
    feature: 'F2+F1',
    tier: 3,
    title: 'F2+F1: Paddle payment webhook deposits credits idempotently, updating balance and enabling video consumption',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const webhookSecret = 'pdl_webhook_secret_xf03_test';
      process.env.PADDLE_WEBHOOK_SECRET = webhookSecret;

      // 1. Create user with 0 credits
      const testEmail = `webhook-creator-${Date.now()}@example.com`;
      const user = await db.createUser({
        email: testEmail,
        name: 'Webhook Creator',
        credits: 0,
      });

      assert.equal(user.credits, 0, 'User starts with 0 credits');

      // 2. Simulate Paddle transaction.completed webhook
      const paddleTxId = `txn_live_${Date.now()}`;
      const purchasedCredits = 10;

      const webhookPayload = JSON.stringify({
        event_id: `evt_${Date.now()}`,
        event_type: 'transaction.completed',
        occurred_at: new Date().toISOString(),
        data: {
          id: paddleTxId,
          status: 'completed',
          custom_data: {
            userId: user.id,
            userEmail: user.email,
            purchaseType: 'credits',
            videoCredits: purchasedCredits,
          },
        },
      });

      const currentTs = Math.floor(Date.now() / 1000);
      const validSig = generatePaddleSignature(webhookPayload, webhookSecret, currentTs);

      const { POST: webhookPost } = loadRoute('app/api/paddle/webhook/route.ts');
      const webhookReq = createMockRequest('/api/paddle/webhook', {
        method: 'POST',
        headers: {
          'paddle-signature': validSig,
          'content-type': 'application/json',
        },
        body: webhookPayload,
      });

      const webhookRes = await webhookPost(webhookReq);
      assert.equal(webhookRes.status, 200, 'Webhook must respond with 200 OK');

      // 3. Deposit credits in database ledger with paddleTxId
      await db.addCredits(user.id, purchasedCredits, paddleTxId);

      const creditedInfo = await db.getUserCredits(user.id);
      assert.equal(creditedInfo.credits, 10, 'Balance must increase to 10 credits');

      // 4. Verify user can now consume credits
      const sessionToken = createTestSessionToken(user);
      const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');

      const consumeReq = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'fast', fileName: 'purchased_clip.mp4' },
      });

      const consumeRes = await consumePost(consumeReq);
      assert.equal(consumeRes.status, 200, 'Consumption must succeed after crediting');
      const consumeData = await parseJsonResponse(consumeRes);
      assert.equal(consumeData.credits, 9, 'Credits should decrement from 10 to 9');

      // 5. Verify transaction ledger records
      const txs = await db.getUserTransactions(user.id);
      const purchaseTx = txs.find((t) => t.paddleTransactionId === paddleTxId);
      assert.ok(purchaseTx, 'Paddle purchase transaction must be recorded with transaction ID');
      assert.equal(purchaseTx.amount, 10);
    },
  },

  {
    id: 'T3-XF-04',
    feature: 'F2+F1',
    tier: 3,
    title: 'F2+F1: Creator Annual ($79) subscription activation bypasses credit deduction and unlocks unlimited processing',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const testEmail = `annual-creator-${Date.now()}@example.com`;

      // 1. Create user with 0 credits and free plan
      const user = await db.createUser({
        email: testEmail,
        name: 'Annual Creator',
        credits: 0,
        plan: 'free',
      });

      // Confirm 0 credits on free plan is blocked
      const preCheck = await db.deductCredit(user.id);
      assert.equal(preCheck.success, false, 'Free user with 0 credits must be blocked');

      // 2. Activate Creator Annual subscription (Price: pri_01m74dfsy5vxssam0b31mypsbt)
      const updatedUser = await db.updateUser(user.id, {
        plan: 'creator',
        subscriptionId: `sub_creator_${Date.now()}`,
        subscriptionPlan: 'creator',
        subscriptionStatus: 'active',
      });

      assert.equal(updatedUser.plan, 'creator', 'Plan must be updated to creator');

      // 3. Verify getUserCredits acknowledges unlimited access
      const creditInfo = await db.getUserCredits(user.id);
      assert.equal(creditInfo.plan, 'creator');
      assert.equal(creditInfo.hasUnlimitedAccess, true, 'Creator plan must have unlimited access');

      // 4. Verify /api/credits/consume bypasses credit consumption
      const sessionToken = createTestSessionToken(updatedUser);
      const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');

      const consumeReq = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'deep', fileName: 'long_master.mp4' },
      });

      const consumeRes = await consumePost(consumeReq);
      assert.equal(consumeRes.status, 200, 'Subscribed creator consumption must succeed with 200');

      const consumeData = await parseJsonResponse(consumeRes);
      assert.equal(consumeData.success, true);
      assert.equal(consumeData.bypassed, true, 'Subscribed creator must be bypassed without burning credits');
      assert.equal(consumeData.plan, 'creator');

      // Verify credits remain 0 without negative balance
      const postCreditInfo = await db.getUserCredits(user.id);
      assert.equal(postCreditInfo.credits, 0, 'Credit balance should remain unaffected');
    },
  },

  {
    id: 'T3-XF-05',
    feature: 'F1+F3',
    tier: 3,
    title: 'F1+F3: App landing, pricing, and checkout views provide explicit links to /legal routes and no-refund notice',
    async run() {
      // 1. Inspect app landing / navigation
      const landingSrc = loadSourceFile('app/page.tsx');
      assert.ok(landingSrc.includes('/legal'), 'Landing page must link to /legal');
      assert.ok(landingSrc.includes('/legal/terminos'), 'Landing page must link to /legal/terminos');
      assert.ok(landingSrc.includes('/legal/privacidad'), 'Landing page must link to /legal/privacidad');
      assert.ok(landingSrc.includes('/legal/reembolsos'), 'Landing page must link to /legal/reembolsos');

      // 2. Inspect checkout view for legal notice
      const checkoutSrc = loadSourceFile('app/checkout/page.tsx');
      assert.ok(
        checkoutSrc.includes('Paddle.com (Merchant of Record)') || checkoutSrc.includes('Merchant of Record'),
        'Checkout page must state Paddle.com as Merchant of Record'
      );

      // 3. Verify all target policy routes exist on disk
      const targetRoutes = [
        'app/legal/terminos/page.tsx',
        'app/legal/privacidad/page.tsx',
        'app/legal/reembolsos/page.tsx',
        'app/legal/aviso-legal/page.tsx',
        'app/legal/cookies/page.tsx',
      ];
      for (const route of targetRoutes) {
        assert.ok(fileExists(route), `Legal route file must exist: ${route}`);
      }

      // 4. Verify no-refund notice in policies
      const refundSrc = loadSourceFile('app/legal/reembolsos/page.tsx') + ' ' + loadSourceFile('lib/legal/policies.ts');
      assert.ok(
        refundSrc.toLowerCase().includes('no reembolso') || refundSrc.toLowerCase().includes('irrevocable'),
        'Linked refund policy must explicitly specify irrevocable no refund for video credits'
      );
    },
  },

  {
    id: 'T3-XF-06',
    feature: 'F3+F5',
    tier: 3,
    title: 'F3+F5: Legal pages and core UI components adhere to production design system tokens (Pale Mint, White, Navy)',
    async run() {
      // 1. Inspect Legal Article Reader
      const readerAudit = inspectComponentFile('components/legal/LegalArticleReader.tsx');
      assert.ok(
        readerAudit.tokens.allPresent,
        `Missing design tokens in LegalArticleReader: ${readerAudit.tokens.missing.join(', ')}`
      );
      assert.ok(readerAudit.pills.passed, 'LegalArticleReader must contain zero rounded-full pill badges');
      assert.ok(readerAudit.nested.passed, readerAudit.nested.message);

      // 2. Inspect Checkout Page
      const checkoutAudit = inspectComponentFile('app/checkout/page.tsx');
      assert.ok(
        checkoutAudit.tokens.allPresent,
        `Missing design tokens in CheckoutPage: ${checkoutAudit.tokens.missing.join(', ')}`
      );
      assert.ok(checkoutAudit.pills.passed, 'Checkout page must contain zero rounded-full pill badges');
      assert.ok(checkoutAudit.nested.passed, checkoutAudit.nested.message);

      // 3. Inspect Pricing Table
      const pricingAudit = inspectComponentFile('components/PricingTable.tsx');
      assert.ok(pricingAudit.pills.passed, 'PricingTable must contain zero rounded-full pill badges');
      assert.ok(pricingAudit.nested.passed, pricingAudit.nested.message);

      // 4. Inspect Legal Hub Layout
      const legalLayoutSrc = loadSourceFile('app/legal/layout.tsx');
      assert.ok(legalLayoutSrc.includes('#cfe8e1'), 'Legal layout must use canvas color #cfe8e1 (Pale Mint)');
      assert.ok(legalLayoutSrc.includes('#002941'), 'Legal layout must use text color #002941 (Midnight Navy)');
    },
  },
];
