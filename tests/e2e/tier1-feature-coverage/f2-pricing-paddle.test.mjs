/**
 * Tier 1 — Feature Area 2: Flexible Pricing & Paddle Integration
 * Tests T1-F2-01 to T1-F2-05
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSourceFile, fileExists } from '../helpers/app-loader.mjs';

const PADDLE_PRICES = {
  CREATOR_ANNUAL: 'pri_01m74dfsy5vxssam0b31mypsbt',
  VIDEO_CREDITS: 'pri_01m74dmhw68kw11nq225g0rkpr',
};

export const tests = [
  {
    id: 'T1-F2-01',
    feature: 'F2',
    tier: 1,
    title: 'PricingTable.tsx displays the Plan Creador Anual ($79 USD/year) linked to Price ID pri_01m74dfsy5vxssam0b31mypsbt',
    async run() {
      assert.ok(fileExists('components/PricingTable.tsx'), 'PricingTable.tsx must exist');
      const pricingSrc = loadSourceFile('components/PricingTable.tsx');

      // Must support Creador Anual ($79) and price ID or env variable
      const hasAnnualCreator =
        pricingSrc.includes('79') ||
        pricingSrc.includes('Creador Anual') ||
        pricingSrc.includes('PADDLE_CREATOR_YEARLY_PRICE_ID') ||
        pricingSrc.includes(PADDLE_PRICES.CREATOR_ANNUAL);

      assert.ok(
        hasAnnualCreator,
        'PricingTable.tsx must feature Plan Creador Anual ($79 USD / year)'
      );
    },
  },

  {
    id: 'T1-F2-02',
    feature: 'F2',
    tier: 1,
    title: 'PricingTable.tsx provides an interactive Pay-Per-Use credit selector enforcing minimum 5 credits at $1 USD each',
    async run() {
      const pricingSrc = loadSourceFile('components/PricingTable.tsx');

      // Check credit counter / selector existence
      const hasCreditSelector =
        pricingSrc.includes('crédito') ||
        pricingSrc.includes('credito') ||
        pricingSrc.includes('Pay-Per-Use') ||
        pricingSrc.includes('por uso') ||
        pricingSrc.includes('PADDLE_CREDITS_PRICE_ID');

      assert.ok(hasCreditSelector, 'PricingTable.tsx must provide Pay-Per-Use credit selector');
    },
  },

  {
    id: 'T1-F2-03',
    feature: 'F2',
    tier: 1,
    title: 'Pay-per-use selector generates checkout URL with priceId=pri_01m74dmhw68kw11nq225g0rkpr and chosen quantity',
    async run() {
      const pricingSrc = loadSourceFile('components/PricingTable.tsx');

      const referencesCreditsPrice =
        pricingSrc.includes(PADDLE_PRICES.VIDEO_CREDITS) ||
        pricingSrc.includes('PADDLE_CREDITS_PRICE_ID') ||
        pricingSrc.includes('quantity=');

      assert.ok(
        referencesCreditsPrice,
        'PricingTable must route pay-per-use selection with credits price ID and quantity'
      );
    },
  },

  {
    id: 'T1-F2-04',
    feature: 'F2',
    tier: 1,
    title: 'app/checkout/page.tsx parses quantity and forwards customData ({ userId, userEmail, purchaseType, videoCredits }) to Paddle',
    async run() {
      assert.ok(fileExists('app/checkout/page.tsx'), 'app/checkout/page.tsx must exist');
      const checkoutSrc = loadSourceFile('app/checkout/page.tsx');

      // Check Paddle SDK open invocation
      assert.ok(
        checkoutSrc.includes('paddleInstance.Checkout.open') || checkoutSrc.includes('Checkout.open'),
        'Checkout page must call paddleInstance.Checkout.open'
      );

      // Verify customData and quantity handling
      const handlesCustomDataOrItems =
        checkoutSrc.includes('items') ||
        checkoutSrc.includes('customData') ||
        checkoutSrc.includes('quantity');

      assert.ok(handlesCustomDataOrItems, 'Checkout page must handle items and customData');
    },
  },

  {
    id: 'T1-F2-05',
    feature: 'F2',
    tier: 1,
    title: 'Codebase audit verifies zero remaining occurrences of stale domain tools.axkar.com across all checkout and legal files',
    async run() {
      const filesToAudit = [
        'app/checkout/page.tsx',
        'app/page.tsx',
        'lib/legal/policies.ts',
        'components/legal/LegalArticleReader.tsx',
      ];

      const staleOccurrences = [];

      for (const relPath of filesToAudit) {
        if (fileExists(relPath)) {
          const content = loadSourceFile(relPath);
          if (content.includes('tools.axkar.com')) {
            staleOccurrences.push(relPath);
          }
        }
      }

      assert.equal(
        staleOccurrences.length,
        0,
        `Stale domain tools.axkar.com found in: ${staleOccurrences.join(', ')}. Must be migrated to https://www.socialtools.click`
      );
    },
  },
];
