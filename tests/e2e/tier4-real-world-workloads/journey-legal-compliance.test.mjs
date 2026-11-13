/**
 * Tier 4 — Real-World Workload Journey 5: Legal Documentation, Reader UI & Design Tokens
 * Test T4-RW-05
 */

import assert from 'node:assert/strict';
import { loadRoute, loadModule, loadSourceFile, fileExists } from '../helpers/app-loader.mjs';
import {
  inspectComponentFile,
  checkDesignTokens,
  checkZeroNestedCards,
  checkZeroRoundedFullPillBadges,
} from '../helpers/dom-inspector.mjs';

export const tests = [
  {
    id: 'T4-RW-05',
    feature: 'F3+F5',
    tier: 4,
    title: 'T4-RW-05: Legal compliance journey: Hub /legal 5 cards -> /legal/reembolsos no refund -> /legal/privacidad local processing & negocios.axkarl@gmail.com -> /legal/aviso-legal Carlos José Molina Villacorta & socialtools.click -> desktop ESC & backdrop modal -> design tokens Pale Mint #cfe8e1, #ffffff, #002941, zero nested cards, zero pill badges',
    async run() {
      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Hub /legal 5 Policy Cards
      // ─────────────────────────────────────────────────────────────────────
      assert.ok(fileExists('app/legal/page.tsx'), 'app/legal/page.tsx must exist');
      const policiesModule = loadModule('lib/legal/policies.ts');

      assert.ok(Array.isArray(policiesModule.LEGAL_HUB_DOCS), 'LEGAL_HUB_DOCS must be an array');
      assert.equal(policiesModule.LEGAL_HUB_DOCS.length, 5, 'Legal hub must offer exactly 5 policy documents');

      const expectedSlugs = ['privacidad', 'terminos', 'reembolsos', 'aviso-legal', 'cookies'];
      for (const slug of expectedSlugs) {
        const doc = policiesModule.LEGAL_HUB_DOCS.find((d) => d.slug === slug);
        assert.ok(doc, `Policy doc for slug "${slug}" must exist in hub`);
        assert.ok(doc.title && doc.title.length > 0, `Policy doc "${slug}" must have title`);
        assert.ok(doc.tagline && doc.tagline.length > 0, `Policy doc "${slug}" must have tagline`);
        assert.ok(typeof doc.readingTime === 'number' && doc.readingTime > 0, `Policy doc "${slug}" must define positive reading time`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: /legal/reembolsos Irrevocable No-Refund Clause
      // ─────────────────────────────────────────────────────────────────────
      assert.ok(fileExists('app/legal/reembolsos/page.tsx'), 'app/legal/reembolsos/page.tsx must exist');
      const refundPageSrc = loadSourceFile('app/legal/reembolsos/page.tsx');
      const refundPolicy = policiesModule.LEGAL_POLICIES['reembolsos'];
      assert.ok(refundPolicy, 'LEGAL_POLICIES must define reembolsos');

      const fullRefundText = (
        refundPageSrc + ' ' + JSON.stringify(refundPolicy)
      ).toLowerCase();

      // Check strict irrevocable no-refund clause
      const hasIrrevocableNoRefund =
        fullRefundText.includes('no reembolso') ||
        fullRefundText.includes('sin reembolso') ||
        fullRefundText.includes('definitivo e irrevocable') ||
        fullRefundText.includes('irrevocable');
      assert.ok(hasIrrevocableNoRefund, 'Policy /legal/reembolsos must contain explicit, irrevocable no-refund clause');

      // Check credit / digital nature specification
      const coversCredits =
        fullRefundText.includes('crédito') ||
        fullRefundText.includes('credito') ||
        fullRefundText.includes('digital') ||
        fullRefundText.includes('consumible');
      assert.ok(coversCredits, 'Policy must explicitly govern video credits and digital deliveries');

      // Check Paddle as Merchant of Record
      assert.ok(
        fullRefundText.includes('paddle') || fullRefundText.includes('merchant of record'),
        'Refund policy must reference Paddle as Merchant of Record'
      );

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: /legal/privacidad Local Processing Claim & Official Contact
      // ─────────────────────────────────────────────────────────────────────
      assert.ok(fileExists('app/legal/privacidad/page.tsx'), 'app/legal/privacidad/page.tsx must exist');
      const privPolicy = policiesModule.LEGAL_POLICIES['privacidad'];
      assert.ok(privPolicy, 'LEGAL_POLICIES must define privacidad');

      const privText = JSON.stringify(privPolicy).toLowerCase();

      // Verify 100% client-side local RAM WebAssembly processing claim
      const hasLocalProcessingClaim =
        privText.includes('local') &&
        (privText.includes('webassembly') || privText.includes('ram') || privText.includes('navegador'));
      assert.ok(
        hasLocalProcessingClaim,
        '/legal/privacidad must explicitly guarantee 100% local client-side processing in RAM via WebAssembly'
      );

      // Verify official privacy email
      assert.ok(
        privText.includes('negocios.axkarl@gmail.com'),
        '/legal/privacidad must state negocios.axkarl@gmail.com as official contact'
      );

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: /legal/aviso-legal Legal Identity & Official Domain
      // ─────────────────────────────────────────────────────────────────────
      assert.ok(fileExists('app/legal/aviso-legal/page.tsx'), 'app/legal/aviso-legal/page.tsx must exist');
      const legalNoticePolicy = policiesModule.LEGAL_POLICIES['aviso-legal'];
      assert.ok(legalNoticePolicy, 'LEGAL_POLICIES must define aviso-legal');

      const noticeText = JSON.stringify(legalNoticePolicy);

      // Verify Carlos José Molina Villacorta identity
      assert.ok(
        noticeText.includes('Carlos José Molina Villacorta'),
        '/legal/aviso-legal must identify registered operator Carlos José Molina Villacorta'
      );

      // Verify domain socialtools.click
      assert.ok(
        noticeText.includes('socialtools.click'),
        '/legal/aviso-legal must specify official domain socialtools.click'
      );

      // Verify GitHub account
      assert.ok(
        noticeText.includes('carlosm-lab'),
        '/legal/aviso-legal must reference GitHub account carlosm-lab'
      );

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5: LegalArticleReader Modal Interaction (Desktop ESC & Backdrop)
      // ─────────────────────────────────────────────────────────────────────
      assert.ok(fileExists('components/legal/LegalArticleReader.tsx'), 'LegalArticleReader.tsx must exist');
      const readerSrc = loadSourceFile('components/legal/LegalArticleReader.tsx');

      // Modal overlay class with top-level z-index
      assert.ok(
        readerSrc.includes('z-[9999]') || readerSrc.includes('z-50'),
        'LegalArticleReader desktop modal must render with high z-index overlay (z-[9999])'
      );

      // Desktop ESC key handler setting return scroll
      assert.ok(
        readerSrc.includes('Escape') || readerSrc.includes('key === "Escape"'),
        'LegalArticleReader must implement Escape keydown close handler'
      );
      assert.ok(
        readerSrc.includes('sessionStorage') && readerSrc.includes('legal_return'),
        'Reader must store return scroll position in sessionStorage on close'
      );

      // Backdrop click handler
      assert.ok(
        readerSrc.includes('handleBackdropClick') ||
        readerSrc.includes('e.target ===') ||
        readerSrc.includes('backdropRef'),
        'LegalArticleReader must provide backdrop click dismissal strictly on outer container'
      );

      // Mobile in-page responsive layout
      assert.ok(
        readerSrc.includes('lg:hidden') || readerSrc.includes('hidden lg:flex') || readerSrc.includes('lg:fixed'),
        'LegalArticleReader must provide responsive split: in-page on mobile, modal on desktop'
      );

      // ─────────────────────────────────────────────────────────────────────
      // STEP 6: Design Tokens Compliance & Hard Prohibitions
      // ─────────────────────────────────────────────────────────────────────
      // 1. Reader Component
      const readerAudit = inspectComponentFile('components/legal/LegalArticleReader.tsx');
      assert.ok(
        readerAudit.tokens.allPresent,
        `Missing design tokens in reader: ${readerAudit.tokens.missing.join(', ')}`
      );
      assert.ok(readerAudit.pills.passed, 'Zero rounded-full pill badges allowed in LegalArticleReader');
      assert.ok(readerAudit.nested.passed, readerAudit.nested.message);

      // 2. Legal Layout
      const layoutSrc = loadSourceFile('app/legal/layout.tsx');
      assert.ok(layoutSrc.includes('#cfe8e1'), 'Legal layout canvas must use Pale Mint #cfe8e1');
      assert.ok(layoutSrc.includes('#002941'), 'Legal layout must use Midnight Navy #002941');

      // 3. Legal Hub Page
      const hubAudit = inspectComponentFile('app/legal/page.tsx');
      assert.ok(hubAudit.pills.passed, 'Zero rounded-full pill badges allowed in Legal Hub');
      assert.ok(hubAudit.nested.passed, hubAudit.nested.message);
    },
  },
];
