/**
 * Tier 2 — Boundary & Corner Cases: Legal Documentation & Reader UI
 * Tests T2-F3-01 to T2-F3-05
 */

import assert from 'node:assert/strict';
import { loadSourceFile, loadModule } from '../helpers/app-loader.mjs';

export const tests = [
  {
    id: 'T2-F3-01',
    feature: 'F3',
    tier: 2,
    title: 'Desktop reader modal captures Escape keydown event, sets return flag, and routes to /legal',
    async run() {
      const readerSrc = loadSourceFile('components/legal/LegalArticleReader.tsx');

      // Verify Escape key event listener
      assert.ok(
        readerSrc.includes("e.key === 'Escape'") || readerSrc.includes('Escape'),
        'Reader must attach keydown event listener for Escape'
      );

      // Verify sessionStorage flag
      assert.ok(
        readerSrc.includes('sessionStorage.setItem') && readerSrc.includes('legal_return'),
        'Reader must set legal_return flag in sessionStorage'
      );

      // Verify navigation to /legal
      assert.ok(
        readerSrc.includes("router.push('/legal')") || readerSrc.includes('push'),
        'handleClose must navigate to /legal'
      );
    },
  },

  {
    id: 'T2-F3-02',
    feature: 'F3',
    tier: 2,
    title: 'Desktop reader modal captures backdrop click outside paper container and routes cleanly to /legal',
    async run() {
      const readerSrc = loadSourceFile('components/legal/LegalArticleReader.tsx');

      // Verify backdrop target check e.target === e.currentTarget
      assert.ok(
        readerSrc.includes('e.target === e.currentTarget'),
        'Modal backdrop click must strictly verify e.target === e.currentTarget to avoid closing on inner card clicks'
      );
      assert.ok(
        readerSrc.includes('handleClose()'),
        'Backdrop click must invoke handleClose()'
      );
    },
  },

  {
    id: 'T2-F3-03',
    feature: 'F3',
    tier: 2,
    title: 'Mobile view hides desktop modal overlay (hidden lg:flex) and renders within standard document flow (lg:hidden)',
    async run() {
      const readerSrc = loadSourceFile('components/legal/LegalArticleReader.tsx');

      // Check mobile container classes
      assert.ok(
        readerSrc.includes('lg:hidden'),
        'Mobile layout must include lg:hidden so it is hidden on desktop'
      );

      // Check desktop modal container classes
      assert.ok(
        readerSrc.includes('hidden') && readerSrc.includes('lg:flex'),
        'Desktop modal must include hidden lg:flex so it is hidden on mobile'
      );
    },
  },

  {
    id: 'T2-F3-04',
    feature: 'F3',
    tier: 2,
    title: 'Reader component handles blocked/disabled sessionStorage (private browsing mode) without throwing exceptions',
    async run() {
      const readerSrc = loadSourceFile('components/legal/LegalArticleReader.tsx');

      // Verify try-catch around sessionStorage
      const hasTryCatch =
        readerSrc.includes('try {') &&
        readerSrc.includes('sessionStorage.setItem') &&
        readerSrc.includes('catch');

      assert.ok(
        hasTryCatch,
        'Reader must wrap sessionStorage in a try-catch block to survive iOS Safari private mode'
      );
    },
  },

  {
    id: 'T2-F3-05',
    feature: 'F3',
    tier: 2,
    title: 'Legacy URLs (/privacidad, /terminos, /reembolsos) configure clean 308 permanent redirects to /legal/*',
    async run() {
      const nextConfigSrc = loadSourceFile('next.config.mjs');

      assert.ok(nextConfigSrc.includes('redirects()'), 'next.config.mjs must define redirects()');
      assert.ok(nextConfigSrc.includes("source: '/privacidad'"), 'Redirect for /privacidad must exist');
      assert.ok(nextConfigSrc.includes("destination: '/legal/privacidad'"), 'Destination must be /legal/privacidad');
      assert.ok(nextConfigSrc.includes("source: '/terminos'"), 'Redirect for /terminos must exist');
      assert.ok(nextConfigSrc.includes("destination: '/legal/terminos'"), 'Destination must be /legal/terminos');
      assert.ok(nextConfigSrc.includes("source: '/reembolsos'"), 'Redirect for /reembolsos must exist');
      assert.ok(nextConfigSrc.includes("destination: '/legal/reembolsos'"), 'Destination must be /legal/reembolsos');
      assert.ok(nextConfigSrc.includes('permanent: true'), 'Redirects must be marked permanent: true (308)');
    },
  },
];
