#!/usr/bin/env node

/**
 * CleanStream Studio — Live Verification of Milestone 3 Auth & Credits Routes
 */

import assert from 'assert';
import { spawn, execSync } from 'child_process';
import crypto from 'crypto';

const TEST_PORT = 3855;
const AUTH_SECRET = 'm3-test-secret-key-32bytes-auth!';
process.env.AUTH_SECRET = AUTH_SECRET;

console.log('================================================================');
console.log('  Milestone 3 Live Route Verification (/api/auth & /api/credits)');
console.log('================================================================\n');

function signTestSession(user) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const payload = { ...user, iat, exp };
  const dataB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

let serverProcess = null;

async function startServer() {
  const fs = await import('fs');
  const path = await import('path');
  const hasBuild = fs.existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'));
  const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const mode = hasBuild ? 'start' : 'dev';

  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [nextBin, mode, '-p', String(TEST_PORT)], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        AUTH_SECRET,
        GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'test-client-secret',
        NEXT_PUBLIC_APP_URL: 'http://localhost:' + TEST_PORT,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess = proc;
    let resolved = false;

    let output = '';
    proc.stdout.on('data', (d) => {
      output += d.toString();
    });

    proc.stderr.on('data', (d) => {
      output += d.toString();
    });

    proc.on('error', reject);

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:${TEST_PORT}/api/auth/me`);
        if (res.status === 200 && !resolved) {
          resolved = true;
          clearInterval(timer);
          resolve(proc);
        }
      } catch {}
    }, 400);

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        clearInterval(timer);
        reject(new Error(`Server failed to start on port ${TEST_PORT} within 30s.\nOutput:\n${output}`));
      }
    }, 30000);
  });
}

function stopServer() {
  if (serverProcess) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: 'ignore' });
      } else {
        serverProcess.kill('SIGKILL');
      }
    } catch {}
    serverProcess = null;
  }
}

try {
  process.stdout.write('[1/6] Starting Next.js server on port ' + TEST_PORT + ' ... ');
  await startServer();
  console.log('READY ✓');

  // Test 1: Unauthenticated /api/auth/me
  process.stdout.write('[2/6] GET /api/auth/me (unauthenticated) ... ');
  const meRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/me`);
  assert.strictEqual(meRes.status, 200);
  const meData = await meRes.json();
  assert.strictEqual(meData.authenticated, false);
  assert.strictEqual(meData.user, null);
  console.log('PASSED ✓');

  // Test 2: Google OAuth initiator /api/auth/google
  process.stdout.write('[3/6] GET /api/auth/google redirect & CSRF cookie ... ');
  const googleRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/google`, {
    redirect: 'manual',
  });
  assert.ok(googleRes.status === 307 || googleRes.status === 302);
  const location = googleRes.headers.get('location');
  assert.ok(location && location.includes('accounts.google.com/o/oauth2/v2/auth'));
  assert.ok(location.includes('client_id=test-client-id'));
  const setCookie = googleRes.headers.get('set-cookie');
  assert.ok(setCookie && setCookie.includes('st_oauth_state'));
  console.log('PASSED ✓');

  // Test 3: Logout endpoint /api/auth/logout
  process.stdout.write('[4/6] POST /api/auth/logout ... ');
  const logoutRes = await fetch(`http://localhost:${TEST_PORT}/api/auth/logout`, {
    method: 'POST',
  });
  assert.strictEqual(logoutRes.status, 200);
  const logoutData = await logoutRes.json();
  assert.strictEqual(logoutData.success, true);
  const logoutCookie = logoutRes.headers.get('set-cookie');
  assert.ok(logoutCookie && logoutCookie.includes('st_session=;'));
  console.log('PASSED ✓');

  // Test 4: Unauthenticated /api/credits/consume returns 401
  process.stdout.write('[5/6] POST /api/credits/consume (unauthenticated) -> 401 ... ');
  const consumeUnauth = await fetch(`http://localhost:${TEST_PORT}/api/credits/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'fast' }),
  });
  assert.strictEqual(consumeUnauth.status, 401);
  const consumeUnauthData = await consumeUnauth.json();
  assert.strictEqual(consumeUnauthData.success, false);
  console.log('PASSED ✓');

  // Test 5: Admin session bypasses credit consumption
  process.stdout.write('[6/6] POST /api/credits/consume with admin session bypasses consumption ... ');
  const adminToken = signTestSession({
    userId: 'usr_admin_123',
    email: 'negocios.axkarl@gmail.com',
    name: 'Axkarl Admin',
    role: 'admin',
    plan: 'unlimited',
  });
  const consumeAdmin = await fetch(`http://localhost:${TEST_PORT}/api/credits/consume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `st_session=${adminToken}`,
    },
    body: JSON.stringify({ mode: 'deep', fileName: 'sample.mp4' }),
  });
  assert.strictEqual(consumeAdmin.status, 200);
  const consumeAdminData = await consumeAdmin.json();
  assert.strictEqual(consumeAdminData.success, true);
  assert.strictEqual(consumeAdminData.bypassed, true);
  assert.strictEqual(consumeAdminData.plan, 'unlimited');
  assert.strictEqual(consumeAdminData.credits, 999999);
  console.log('PASSED ✓');

  console.log('\n================================================================');
  console.log('  ALL M3 LIVE ROUTE TESTS PASSED (100% GREEN)');
  console.log('================================================================\n');
} finally {
  stopServer();
}
