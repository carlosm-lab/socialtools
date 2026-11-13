/**
 * Tier 2 — Boundary & Corner Cases: Git, Environment Variables & Security Boundaries
 * Tests T2-F5-01 to T2-F5-05
 */

import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { loadRoute, loadSourceFile } from '../helpers/app-loader.mjs';
import { createMockRequest, parseJsonResponse } from '../helpers/test-context.mjs';

export const tests = [
  {
    id: 'T2-F5-01',
    feature: 'F5',
    tier: 2,
    title: 'Missing optional environment variables (PADDLE_WEBHOOK_SECRET) fall back safely without unhandled crashes',
    async run() {
      const originalSecret = process.env.PADDLE_WEBHOOK_SECRET;
      delete process.env.PADDLE_WEBHOOK_SECRET;

      try {
        const { POST } = loadRoute('app/api/paddle/webhook/route.ts');
        const req = createMockRequest('/api/paddle/webhook', {
          method: 'POST',
          body: { event_type: 'subscription.created', event_id: 'evt_dev_test' },
        });

        const res = await POST(req);
        assert.equal(res.status, 200, 'When secret is omitted in dev, webhook must not crash');
        const data = await parseJsonResponse(res);
        assert.equal(data.ok, true);
      } finally {
        if (originalSecret) process.env.PADDLE_WEBHOOK_SECRET = originalSecret;
      }
    },
  },

  {
    id: 'T2-F5-02',
    feature: 'F5',
    tier: 2,
    title: 'next.config.mjs configures COOP same-origin-allow-popups on /api/auth/(.*) to allow OAuth popup handshake',
    async run() {
      const nextConfigSrc = loadSourceFile('next.config.mjs');

      assert.ok(
        nextConfigSrc.includes("source: '/api/auth/(.*)'"),
        "next.config.mjs must contain route rule for '/api/auth/(.*)'"
      );
      assert.ok(
        nextConfigSrc.includes('same-origin-allow-popups'),
        "next.config.mjs must assign 'same-origin-allow-popups' to permit OAuth login popups/redirects"
      );
      assert.ok(
        nextConfigSrc.includes('unsafe-none'),
        "next.config.mjs must relax COEP to 'unsafe-none' on auth route"
      );
    },
  },

  {
    id: 'T2-F5-03',
    feature: 'F5',
    tier: 2,
    title: 'next.config.mjs retains COOP same-origin on root /(.*) to maintain SharedArrayBuffer support for WebAssembly',
    async run() {
      const nextConfigSrc = loadSourceFile('next.config.mjs');

      assert.ok(
        nextConfigSrc.includes("source: '/(.*)'"),
        "next.config.mjs must set global headers on '/(.*)'"
      );
      assert.ok(
        nextConfigSrc.includes("value: 'same-origin'"),
        "Global rule must set 'same-origin' for WebAssembly isolation"
      );
      assert.ok(
        nextConfigSrc.includes("value: 'require-corp'"),
        "Global rule must set 'require-corp' for SharedArrayBuffer support"
      );
    },
  },

  {
    id: 'T2-F5-04',
    feature: 'F5',
    tier: 2,
    title: 'Staging a mock .mp4 file or .env.local is strictly blocked by git rules (git check-ignore)',
    async run() {
      // 1. Test .mp4 ignore rule
      try {
        const mp4Ignored = execSync('git check-ignore dummy_video_test.mp4', { encoding: 'utf8' }).trim();
        assert.ok(mp4Ignored.includes('.mp4'), 'Git must ignore dummy_video_test.mp4');
      } catch (err) {
        assert.fail(`git check-ignore failed to ignore .mp4 file: ${err.message}`);
      }

      // 2. Test .env.local ignore rule
      try {
        const envIgnored = execSync('git check-ignore .env.local', { encoding: 'utf8' }).trim();
        assert.ok(envIgnored.includes('.env'), 'Git must ignore .env.local');
      } catch (err) {
        assert.fail(`git check-ignore failed to ignore .env.local: ${err.message}`);
      }

      // 3. Test data/ ignore rule
      try {
        const dataIgnored = execSync('git check-ignore data/test_socialtools.json', { encoding: 'utf8' }).trim();
        assert.ok(dataIgnored.includes('data'), 'Git must ignore data/ folder');
      } catch (err) {
        assert.fail(`git check-ignore failed to ignore data/ file: ${err.message}`);
      }
    },
  },

  {
    id: 'T2-F5-05',
    feature: 'F5',
    tier: 2,
    title: 'Application authentication layer avoids exposing secret credentials in client-facing payloads',
    async run() {
      const authSrc = loadSourceFile('lib/auth.ts');

      // Verify signSession and payload do not contain secrets
      assert.ok(!authSrc.includes('client_secret: process.env.GOOGLE_CLIENT_SECRET'), 'Payload must never embed client secret');
      assert.ok(!authSrc.includes('auth_secret: process.env.AUTH_SECRET'), 'Payload must never embed auth secret');

      // Verify SessionPayload interface fields are non-sensitive
      assert.ok(
        authSrc.includes('SessionUser') || authSrc.includes('SessionPayload'),
        'lib/auth.ts must type session with SessionUser or SessionPayload'
      );
    },
  },
];
