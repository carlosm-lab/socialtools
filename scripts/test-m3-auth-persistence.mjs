#!/usr/bin/env node

/**
 * Milestone 3 Test Suite: Google Auth, Persistence, Sessions & Credits
 */

import assert from 'assert';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Setup test environment
const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'test-m3-data');
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.AUTH_SECRET = 'test-secret-key-socialtools-32bytes!!';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret';

console.log('================================================================');
console.log('  SocialTools Studio — Milestone 3 Automated Test Suite');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
  totalTests++;
  process.stdout.write(`[M3 TEST ${totalTests}] ${name} ... `);
  try {
    await fn();
    passedTests++;
    console.log('PASSED ✓');
  } catch (err) {
    console.log('FAILED ✗');
    console.error('  Error:', err);
    throw err;
  }
}

// Import modules to test
const {
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  getUserCredits,
  deductCredit,
  addCredits,
  logTransaction,
  getUserTransactions,
  reconcileUserWithEntitlements,
  __resetDbForTesting,
  ADMIN_EMAIL,
  ADMIN_UNLIMITED_CREDITS,
  FREE_WELCOME_CREDITS,
} = await import('../lib/db.ts');

const {
  signSession,
  verifySession,
  signEntitlements,
  verifyEntitlements,
  SESSION_COOKIE_NAME,
  ENTITLEMENTS_COOKIE_NAME,
} = await import('../lib/auth.ts');

// Clean test state before running
if (fs.existsSync(TEST_DATA_DIR)) {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}
await __resetDbForTesting();

// ---------------------------------------------------------------------------
// 1. Database & Persistence Layer Tests
// ---------------------------------------------------------------------------
console.log('--- Suite 1: Database & Persistence Layer ---');

await test('New user creation automatically grants 1 free credit and free_grant tx', async () => {
  const newUser = await createUser({
    email: 'creator.test@example.com',
    name: 'Test Creator',
    googleId: 'google-sub-1001',
  });

  assert.strictEqual(newUser.email, 'creator.test@example.com');
  assert.strictEqual(newUser.credits, FREE_WELCOME_CREDITS);
  assert.strictEqual(newUser.role, 'user');
  assert.strictEqual(newUser.plan, 'free');

  const creditsInfo = await getUserCredits(newUser.id);
  assert.strictEqual(creditsInfo.credits, 1);
  assert.strictEqual(creditsInfo.isAdmin, false);
  assert.strictEqual(creditsInfo.hasUnlimitedAccess, false);

  const txs = await getUserTransactions(newUser.id);
  assert.strictEqual(txs.length, 1);
  assert.strictEqual(txs[0].type, 'free_grant');
  assert.strictEqual(txs[0].amount, 1);
  assert.strictEqual(txs[0].balanceAfter, 1);
});

await test('Admin account negocios.axkarl@gmail.com is automatically granted unlimited admin plan', async () => {
  const adminUser = await createUser({
    email: ADMIN_EMAIL,
    name: 'Admin Axkarl',
    googleId: 'google-sub-admin-001',
  });

  assert.strictEqual(adminUser.email, ADMIN_EMAIL.toLowerCase());
  assert.strictEqual(adminUser.role, 'admin');
  assert.strictEqual(adminUser.plan, 'unlimited');
  assert.strictEqual(adminUser.credits, ADMIN_UNLIMITED_CREDITS);

  const creditsInfo = await getUserCredits(adminUser.id);
  assert.strictEqual(creditsInfo.credits, ADMIN_UNLIMITED_CREDITS);
  assert.strictEqual(creditsInfo.isAdmin, true);
  assert.strictEqual(creditsInfo.hasUnlimitedAccess, true);

  const txs = await getUserTransactions(adminUser.id);
  assert.ok(txs.some((t) => t.type === 'admin_grant'));
});

await test('Credit deduction atomically consumes 1 credit on free user', async () => {
  const user = await getUserByEmail('creator.test@example.com');
  assert.ok(user);

  const res1 = await deductCredit(user.id, 'Video 1 cleaning');
  assert.strictEqual(res1.success, true);
  assert.strictEqual(res1.remaining, 0);
  assert.strictEqual(res1.bypassed, false);

  // Second deduction must fail with zero balance
  const res2 = await deductCredit(user.id, 'Video 2 cleaning');
  assert.strictEqual(res2.success, false);
  assert.strictEqual(res2.remaining, 0);
  assert.ok(res2.error);
});

await test('Admin account bypasses credit deduction with zero credit loss', async () => {
  const admin = await getUserByEmail(ADMIN_EMAIL);
  assert.ok(admin);

  const res = await deductCredit(admin.id, 'Admin test video');
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.bypassed, true);
  assert.strictEqual(res.remaining, ADMIN_UNLIMITED_CREDITS);
});

await test('Add credits successfully increments user balance and logs transaction', async () => {
  const user = await getUserByEmail('creator.test@example.com');
  assert.ok(user);

  const updated = await addCredits(user.id, 10, 'txn_paddle_test_123');
  assert.strictEqual(updated.credits, 10);

  const txs = await getUserTransactions(user.id);
  const purchaseTx = txs.find((t) => t.paddleTransactionId === 'txn_paddle_test_123');
  assert.ok(purchaseTx);
  assert.strictEqual(purchaseTx.type, 'paddle_purchase');
  assert.strictEqual(purchaseTx.amount, 10);
  assert.strictEqual(purchaseTx.balanceAfter, 10);
});

await test('Concurrent credit deductions are race-condition free (Mutex lock)', async () => {
  // Create a user with 5 credits
  const user = await createUser({
    email: 'concurrency.test@example.com',
    googleId: 'sub-concurrency-99',
    credits: 5,
  });

  // Launch 15 concurrent deductions
  const promises = Array.from({ length: 15 }, (_, i) =>
    deductCredit(user.id, `Concurrent click #${i}`)
  );
  const results = await Promise.all(promises);

  const successful = results.filter((r) => r.success);
  const rejected = results.filter((r) => !r.success);

  assert.strictEqual(successful.length, 5, 'Exactly 5 deductions should succeed');
  assert.strictEqual(rejected.length, 10, 'Exactly 10 deductions should be rejected');

  const finalUser = await getUserById(user.id);
  assert.strictEqual(finalUser.credits, 0, 'Final credits balance must be 0');
});

// ---------------------------------------------------------------------------
// 2. Authentication & HMAC Signing Tests
// ---------------------------------------------------------------------------
console.log('\n--- Suite 2: Auth HMAC-SHA256 & Session Tokens ---');

await test('Session token signing and verification succeeds', () => {
  const sessionUser = {
    userId: 'usr_12345',
    email: 'user@example.com',
    name: 'Sample User',
    picture: 'https://example.com/pic.jpg',
    role: 'user',
    plan: 'free',
  };

  const token = signSession(sessionUser, 3600);
  assert.ok(token.includes('.'));

  const verified = verifySession(token);
  assert.ok(verified);
  assert.strictEqual(verified.userId, 'usr_12345');
  assert.strictEqual(verified.email, 'user@example.com');
  assert.strictEqual(verified.role, 'user');
  assert.strictEqual(verified.plan, 'free');
});

await test('Tampered session token signature is rejected by timingSafeEqual', () => {
  const sessionUser = {
    userId: 'usr_tamper',
    email: 'tamper@example.com',
    name: 'Tamper',
    role: 'user',
    plan: 'free',
  };

  const token = signSession(sessionUser, 3600);
  const [dataB64, sig] = token.split('.');

  // Alter payload
  const tamperedPayload = Buffer.from(
    JSON.stringify({ ...sessionUser, role: 'admin', plan: 'unlimited', iat: 1, exp: 9999999999 })
  ).toString('base64url');
  const tamperedToken = `${tamperedPayload}.${sig}`;

  assert.strictEqual(verifySession(tamperedToken), null);

  // Alter signature
  const brokenSig = sig.slice(0, -2) + 'aa';
  assert.strictEqual(verifySession(`${dataB64}.${brokenSig}`), null);
});

// ---------------------------------------------------------------------------
// 3. Dual-Layer Entitlements Cookie Ledger Tests
// ---------------------------------------------------------------------------
console.log('\n--- Suite 3: Dual-Layer Entitlements Cookie Ledger ---');

await test('Entitlements cookie ledger signs and verifies correctly', () => {
  const ledger = {
    sub: 'google-sub-2002',
    email: 'serverless.user@example.com',
    credits: 7,
    trialGranted: true,
    plan: 'free',
    processedTxIds: ['txn_001', 'txn_002'],
  };

  const token = signEntitlements(ledger, 3600);
  assert.ok(token.includes('.'));

  const verified = verifyEntitlements(token);
  assert.ok(verified);
  assert.strictEqual(verified.email, 'serverless.user@example.com');
  assert.strictEqual(verified.credits, 7);
  assert.strictEqual(verified.trialGranted, true);
  assert.deepStrictEqual(verified.processedTxIds, ['txn_001', 'txn_002']);
});

await test('Reconciliation recovers user record from signed cookie after cold start reset', async () => {
  const ledger = {
    sub: 'google-sub-reconcile-88',
    email: 'reconciled.user@example.com',
    credits: 4,
    trialGranted: true,
    plan: 'creator',
    processedTxIds: ['txn_rec_1'],
  };

  // Reconcile user without pre-existing disk record
  const reconciledUser = await reconcileUserWithEntitlements(ledger, {
    name: 'Reconciled Creator',
  });

  assert.ok(reconciledUser);
  assert.strictEqual(reconciledUser.email, 'reconciled.user@example.com');
  assert.strictEqual(reconciledUser.credits, 4);
  assert.strictEqual(reconciledUser.plan, 'creator');

  // Verify it was persisted to disk/memory
  const fetched = await getUserByEmail('reconciled.user@example.com');
  assert.ok(fetched);
  assert.strictEqual(fetched.credits, 4);
  assert.strictEqual(fetched.plan, 'creator');
});

// Clean up test data
if (fs.existsSync(TEST_DATA_DIR)) {
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
}

console.log('\n================================================================');
console.log(`  ALL ${passedTests}/${totalTests} M3 TESTS PASSED SUCCESSFULLY (100% GREEN)`);
console.log('================================================================\n');
