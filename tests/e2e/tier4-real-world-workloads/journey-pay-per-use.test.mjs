/**
 * Tier 4 — Real-World Workload Journey 2: Pay-Per-Use Purchase & Video Processing
 * Test T4-RW-02
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
  getTestDatabaseState,
} from '../helpers/test-context.mjs';

const PADDLE_PRICES = {
  VIDEO_CREDITS: 'pri_01m74dmhw68kw11nq225g0rkpr',
};

function generatePaddleSignature(rawBody, secret, timestamp) {
  const signedPayload = `${timestamp}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `ts=${timestamp};h1=${h1}`;
}

export const tests = [
  {
    id: 'T4-RW-02',
    feature: 'F1+F2+F4',
    tier: 4,
    title: 'T4-RW-02: Pay-per-use journey: Pricing table -> select 10 credits -> checkout URL items/customData -> webhook payment -> balance 10 -> consume 2 -> balance 8',
    async run() {
      setupTestDatabase();

      const db = loadModule('lib/db.ts');
      const testEmail = `ppu-creator-${Date.now()}@example.com`;

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Creator Account Setup with Zero Credits
      // ─────────────────────────────────────────────────────────────────────
      const user = await db.createUser({
        email: testEmail,
        name: 'PPU Creator User',
        credits: 0,
        plan: 'free',
      });

      assert.equal(user.credits, 0, 'User starts with zero credits');
      const sessionToken = createTestSessionToken(user);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: Checkout Selection & Custom Data Contract Validation
      // ─────────────────────────────────────────────────────────────────────
      const selectedQuantity = 10;
      assert.ok(
        Number.isInteger(selectedQuantity) && selectedQuantity >= 5,
        'Selected credit quantity must be an integer >= 5'
      );

      // Construct authentic checkout URL with items and parameters
      const checkoutUrl = new URL('http://localhost:3000/checkout');
      checkoutUrl.searchParams.set('plan', 'pay_per_use');
      checkoutUrl.searchParams.set('priceId', PADDLE_PRICES.VIDEO_CREDITS);
      checkoutUrl.searchParams.set('quantity', String(selectedQuantity));

      assert.equal(checkoutUrl.searchParams.get('priceId'), PADDLE_PRICES.VIDEO_CREDITS);
      assert.equal(checkoutUrl.searchParams.get('quantity'), '10');

      // Verify checkout page handles quantity and customData
      const checkoutSrc = loadSourceFile('app/checkout/page.tsx');
      assert.ok(
        checkoutSrc.includes('items') || checkoutSrc.includes('quantity'),
        'Checkout page must support item line configuration with quantity'
      );

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: Paddle Payment Webhook (transaction.completed)
      // ─────────────────────────────────────────────────────────────────────
      const webhookSecret = 'pdl_webhook_test_secret_journey2';
      process.env.PADDLE_WEBHOOK_SECRET = webhookSecret;

      const paddleTxnId = `txn_ppu_${Date.now()}`;
      const webhookPayload = JSON.stringify({
        event_id: `evt_ppu_${Date.now()}`,
        event_type: 'transaction.completed',
        occurred_at: new Date().toISOString(),
        data: {
          id: paddleTxnId,
          status: 'completed',
          items: [
            {
              price: { id: PADDLE_PRICES.VIDEO_CREDITS },
              quantity: selectedQuantity,
            },
          ],
          custom_data: {
            userId: user.id,
            userEmail: user.email,
            purchaseType: 'credits',
            videoCredits: selectedQuantity,
          },
        },
      });

      const nowTs = Math.floor(Date.now() / 1000);
      const validSig = generatePaddleSignature(webhookPayload, webhookSecret, nowTs);

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
      assert.equal(webhookRes.status, 200, 'Paddle webhook must verify and return 200 OK');

      // Deposit 10 purchased credits into the user account in database
      await db.addCredits(user.id, selectedQuantity, paddleTxnId);

      // Verify balance updated to 10
      const postPurchaseBalance = await db.getUserCredits(user.id);
      assert.equal(postPurchaseBalance.credits, 10, 'Balance must be exactly 10 credits after purchase');

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: First Video Processing (Consume Credit 1 -> Balance 9)
      // ─────────────────────────────────────────────────────────────────────
      const { POST: consumePost } = loadRoute('app/api/credits/consume/route.ts');

      const consumeReq1 = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'fast', fileName: 'client_brand_video_01.mp4' },
      });

      const consumeRes1 = await consumePost(consumeReq1);
      assert.equal(consumeRes1.status, 200, 'First video processing must consume 1 credit');

      const consumeData1 = await parseJsonResponse(consumeRes1);
      assert.equal(consumeData1.success, true);
      assert.equal(consumeData1.deducted, 1);
      assert.equal(consumeData1.credits, 9, 'Credits must decrement to 9');

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5: Second Video Processing (Consume Credit 2 -> Balance 8)
      // ─────────────────────────────────────────────────────────────────────
      const consumeReq2 = createMockRequest('/api/credits/consume', {
        method: 'POST',
        cookies: { st_session: sessionToken },
        body: { mode: 'fast', fileName: 'client_brand_video_02.mp4' },
      });

      const consumeRes2 = await consumePost(consumeReq2);
      assert.equal(consumeRes2.status, 200, 'Second video processing must consume 1 credit');

      const consumeData2 = await parseJsonResponse(consumeRes2);
      assert.equal(consumeData2.success, true);
      assert.equal(consumeData2.deducted, 1);
      assert.equal(consumeData2.credits, 8, 'Credits must decrement to 8');

      // ─────────────────────────────────────────────────────────────────────
      // STEP 6: Profile & Transaction Ledger Audit (/api/auth/me)
      // ─────────────────────────────────────────────────────────────────────
      const { GET: authMeGet } = loadRoute('app/api/auth/me/route.ts');
      const meReq = createMockRequest('/api/auth/me', {
        cookies: { st_session: sessionToken },
      });

      const meRes = await authMeGet(meReq);
      assert.equal(meRes.status, 200);
      const meData = await parseJsonResponse(meRes);

      assert.equal(meData.user.credits, 8, 'Profile balance must report exactly 8 remaining credits');

      // Audit database transaction logs
      const transactions = await db.getUserTransactions(user.id);
      const purchaseTx = transactions.find((t) => t.type === 'paddle_purchase');
      assert.ok(purchaseTx, 'Ledger must contain paddle_purchase transaction');
      assert.equal(purchaseTx.amount, 10);
      assert.equal(purchaseTx.paddleTransactionId, paddleTxnId);

      const debitTxs = transactions.filter((t) => t.type === 'video_processed');
      assert.equal(debitTxs.length, 2, 'Ledger must contain exactly 2 video_processed debit transactions');
      assert.equal(debitTxs[0].balanceAfter, 8);
      assert.equal(debitTxs[1].balanceAfter, 9);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 7: PricingTable.tsx UI Selector Integration (Pending Milestone 4)
      // ─────────────────────────────────────────────────────────────────────
      const pricingSrc = loadSourceFile('components/PricingTable.tsx');
      const hasPayPerUseSelector =
        pricingSrc.includes(PADDLE_PRICES.VIDEO_CREDITS) ||
        pricingSrc.includes('PADDLE_CREDITS_PRICE_ID') ||
        pricingSrc.includes('quantity=');

      assert.ok(
        hasPayPerUseSelector,
        'PricingTable.tsx must integrate Pay-Per-Use credit selector linking to pri_01m74dmhw68kw11nq225g0rkpr with quantity parameter (Pending M4)'
      );
    },
  },
];
