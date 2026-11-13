/**
 * Tier 1 — Feature Area 3: Legal Documentation & Reader UI
 * Tests T1-F3-01 to T1-F3-05
 */

import assert from 'node:assert/strict';
import { loadModule, loadSourceFile, fileExists } from '../helpers/app-loader.mjs';
import { inspectComponentFile, checkDesignTokens } from '../helpers/dom-inspector.mjs';

export const tests = [
  {
    id: 'T1-F3-01',
    feature: 'F3',
    tier: 1,
    title: 'Legal Hub route /legal renders index of 5 policy cards with reading times and summaries',
    async run() {
      const legalPolicies = loadModule('lib/legal/policies.ts');
      assert.ok(legalPolicies.LEGAL_HUB_DOCS, 'Expected LEGAL_HUB_DOCS array');
      assert.equal(legalPolicies.LEGAL_HUB_DOCS.length, 5, 'Must have exactly 5 legal documents');

      const expectedSlugs = ['privacidad', 'terminos', 'reembolsos', 'aviso-legal', 'cookies'];
      for (const slug of expectedSlugs) {
        const doc = legalPolicies.LEGAL_HUB_DOCS.find((d) => d.slug === slug);
        assert.ok(doc, `Missing policy documentation for slug: ${slug}`);
        assert.ok(doc.title, `Document ${slug} must have a title`);
        assert.ok(doc.tagline, `Document ${slug} must have a tagline/summary`);
        assert.ok(typeof doc.readingTime === 'number' && doc.readingTime > 0, `Document ${slug} must have positive reading time`);
      }

      assert.ok(fileExists('app/legal/page.tsx'), 'app/legal/page.tsx must exist');
      const hubPageSrc = loadSourceFile('app/legal/page.tsx');
      assert.ok(hubPageSrc.includes('LEGAL_HUB_DOCS') || hubPageSrc.includes('LegalHubClient'), 'Legal hub page must render policy cards');
    },
  },

  {
    id: 'T1-F3-02',
    feature: 'F3',
    tier: 1,
    title: 'All 5 legal routes exist and load content: privacidad, terminos, reembolsos, aviso-legal, cookies',
    async run() {
      const requiredRoutes = [
        'app/legal/privacidad/page.tsx',
        'app/legal/terminos/page.tsx',
        'app/legal/reembolsos/page.tsx',
        'app/legal/aviso-legal/page.tsx',
        'app/legal/cookies/page.tsx',
      ];

      for (const routePath of requiredRoutes) {
        assert.ok(fileExists(routePath), `Required legal route file does not exist: ${routePath}`);
        const source = loadSourceFile(routePath);
        assert.ok(
          source.includes('LegalArticleReader') || source.includes('PolicyRenderer'),
          `Route ${routePath} must render policy reader or renderer`
        );
      }
    },
  },

  {
    id: 'T1-F3-03',
    feature: 'F3',
    tier: 1,
    title: '/legal/reembolsos contains explicit, irrevocable NO REFUND clause for consumed and active digital credits',
    async run() {
      const refundPageSrc = loadSourceFile('app/legal/reembolsos/page.tsx');
      const policiesSrc = loadSourceFile('lib/legal/policies.ts');

      const combinedText = (refundPageSrc + ' ' + policiesSrc).toLowerCase();

      // Check for strict no-refund language
      const hasNoRefund =
        combinedText.includes('no reembolso') ||
        combinedText.includes('sin reembolso') ||
        combinedText.includes('no reembolsable') ||
        combinedText.includes('definitivo e irrevocable');

      assert.ok(hasNoRefund, 'Policy must state explicit no-refund clause');

      // Check for credit / digital goods specification
      const hasCreditScope =
        combinedText.includes('crédito') ||
        combinedText.includes('digital') ||
        combinedText.includes('consum');

      assert.ok(hasCreditScope, 'Policy must cover digital video credits');
    },
  },

  {
    id: 'T1-F3-04',
    feature: 'F3',
    tier: 1,
    title: 'LegalArticleReader.tsx renders mobile in-page layout for <lg and fixed desktop modal overlay (z-[9999]) for >=lg',
    async run() {
      assert.ok(fileExists('components/legal/LegalArticleReader.tsx'), 'LegalArticleReader.tsx must exist');
      const readerSrc = loadSourceFile('components/legal/LegalArticleReader.tsx');

      // 1. Mobile responsive layout container
      assert.ok(
        readerSrc.includes('lg:hidden') || readerSrc.includes('mobileLayout'),
        'Reader must implement dedicated mobile/tablet in-page document layout'
      );

      // 2. Fixed desktop modal overlay with high z-index
      assert.ok(
        readerSrc.includes('fixed inset-0') && readerSrc.includes('z-[9999]'),
        'Reader must implement fixed desktop modal overlay with z-[9999]'
      );
      assert.ok(
        readerSrc.includes('hidden') && readerSrc.includes('lg:flex'),
        'Desktop modal must only be visible on desktop screens (>=lg)'
      );

      // 3. Close handlers (ESC key + backdrop click)
      assert.ok(readerSrc.includes('Escape'), 'Desktop modal must handle Escape key');
      assert.ok(
        readerSrc.includes('sessionStorage') && readerSrc.includes('legal_return'),
        'Reader must set session flag to skip reload flicker on return'
      );
    },
  },

  {
    id: 'T1-F3-05',
    feature: 'F3',
    tier: 1,
    title: 'Legal UI conforms to Pale Mint #cfe8e1 canvas, white #ffffff surface, #b8d8cf borders, and Midnight Navy #002941 text/buttons',
    async run() {
      // 1. Inspect Reader Component
      const readerResult = inspectComponentFile('components/legal/LegalArticleReader.tsx');
      assert.ok(readerResult.tokens.allPresent, `Missing design tokens in reader: ${readerResult.tokens.missing.join(', ')}`);
      assert.ok(readerResult.pills.passed, `Pill badges found violating design system: ${readerResult.pills.occurrences.join(', ')}`);
      assert.ok(readerResult.nested.passed, readerResult.nested.message);
      assert.ok(readerResult.gradients.passed, `Prohibited gradients found: ${readerResult.gradients.violations.join(', ')}`);

      // 2. Inspect Legal Layout
      const layoutSrc = loadSourceFile('app/legal/layout.tsx');
      const layoutTokens = checkDesignTokens(layoutSrc, ['#cfe8e1']);
      assert.ok(layoutTokens.allPresent, 'Legal layout must use Pale Mint #cfe8e1 canvas background');
    },
  },
];
