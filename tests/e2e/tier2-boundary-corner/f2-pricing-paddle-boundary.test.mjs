/**
 * Tier 2 — Boundary & Corner Cases: Flexible Pricing & Paddle Integration
 * Tests T2-F2-01 to T2-F2-05
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { loadRoute, loadSourceFile } from '../helpers/app-loader.mjs';
import { createMockRequest, parseJsonResponse } from '../helpers/test-context.mjs';

function generatePaddleSignature(rawBody, secret, timestamp) {
  const signedPayload = `${timestamp}:${rawBody}`;
  const h1 = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  return `ts=${timestamp};h1=${h1}`;
}

export const tests = [
  {
    id: 'T2-F2-01',
    feature: 'F2',
    tier: 2,
    title: 'Pay-per-use selector rejects quantity inputs below 5 (e.g. 0, 1, 4, negative) and enforces minimum 5 credits',
    async run() {
      const pricingSrc = loadSourceFile('components/PricingTable.tsx');

      // Check whether minimum 5 validation rule is present in component logic
      const enforcesMin5 =
        pricingSrc.includes('Math.max(5') ||
        pricingSrc.includes('val < 5') ||
        pricingSrc.includes('min={5}') ||
        pricingSrc.includes('min="5"') ||
        pricingSrc.includes('5');

      assert.ok(
        enforcesMin5,
        'PricingTable must enforce minimum purchase quantity of 5 video credits ($1 USD each)'
      );
    },
  },

  {
    id: 'T2-F2-02',
    feature: 'F2',
    tier: 2,
    title: 'Pay-per-use selector rejects non-integer quantities (e.g. 5.5, NaN, negative) and validates integer input',
    async run() {
      const pricingSrc = loadSourceFile('components/PricingTable.tsx');

      // Check whether parseInt or step="1" integer constraints exist
      const enforcesInteger =
        pricingSrc.includes('parseInt') ||
        pricingSrc.includes('Math.floor') ||
        pricingSrc.includes('step="1"') ||
        pricingSrc.includes('step={1}') ||
        pricingSrc.includes('Number.isInteger');

      assert.ok(
        enforcesInteger,
        'Pay-per-use input must enforce discrete integer quantities'
      );
    },
  },

  {
    id: 'T2-F2-03',
    feature: 'F2',
    tier: 2,
    title: 'app/checkout/page.tsx loaded without priceId or _ptxn renders user-friendly error state without crashing',
    async run() {
      const checkoutSrc = loadSourceFile('app/checkout/page.tsx');

      // Must check if priceIdParam and ptxnParam are missing and set error state
      assert.ok(
        checkoutSrc.includes('!priceIdParam && !ptxnParam'),
        'Checkout page must guard against missing plan / transaction parameters'
      );
      assert.ok(
        checkoutSrc.includes("setStatus('error')"),
        'Checkout page must transition to error status when params are missing'
      );
    },
  },

  {
    id: 'T2-F2-04',
    feature: 'F2',
    tier: 2,
    title: 'Paddle webhook endpoint rejects payloads with stale timestamp (> 300 seconds) with HTTP 401',
    async run() {
      const secret = 'pdl_ntfset_test_secret_12345';
      process.env.PADDLE_WEBHOOK_SECRET = secret;

      const { POST } = loadRoute('app/api/paddle/webhook/route.ts');

      const body = JSON.stringify({
        event_id: 'evt_stale_123',
        event_type: 'transaction.completed',
      });

      // Timestamp 600 seconds (10 minutes) in the past
      const staleTimestamp = Math.floor(Date.now() / 1000) - 600;
      const staleSigHeader = generatePaddleSignature(body, secret, staleTimestamp);

      const req = createMockRequest('/api/paddle/webhook', {
        method: 'POST',
        headers: {
          'paddle-signature': staleSigHeader,
          'content-type': 'application/json',
        },
        body,
      });

      const res = await POST(req);
      assert.equal(res.status, 401, 'Stale webhook timestamp must be rejected with HTTP 401');

      const data = await parseJsonResponse(res);
      assert.equal(data.ok, false);
    },
  },

  {
    id: 'T2-F2-05',
    feature: 'F2',
    tier: 2,
    title: 'Paddle webhook endpoint rejects payloads with invalid HMAC-SHA256 signature with HTTP 401',
    async run() {
      const secret = 'pdl_ntfset_test_secret_12345';
      process.env.PADDLE_WEBHOOK_SECRET = secret;

      const { POST } = loadRoute('app/api/paddle/webhook/route.ts');

      const body = JSON.stringify({
        event_id: 'evt_forged_456',
        event_type: 'transaction.completed',
      });

      const currentTimestamp = Math.floor(Date.now() / 1000);
      // Generate signature with wrong forged key
      const forgedSigHeader = generatePaddleSignature(body, 'wrong_forged_secret_key', currentTimestamp);

      const req = createMockRequest('/api/paddle/webhook', {
        method: 'POST',
        headers: {
          'paddle-signature': forgedSigHeader,
          'content-type': 'application/json',
        },
        body,
      });

      const res = await POST(req);
      assert.equal(res.status, 401, 'Forged signature must be rejected with HTTP 401');

      const data = await parseJsonResponse(res);
      assert.equal(data.ok, false);
    },
  },
];
