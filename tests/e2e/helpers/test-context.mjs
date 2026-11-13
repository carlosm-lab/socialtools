/**
 * Test Context Helper for E2E Tests
 * Provides database sandboxing, NextRequest mock generation, and session token helpers.
 */

import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { NextRequest } = require('next/server');

export const TEST_DATA_DIR = path.join(process.cwd(), 'data');
export const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'test_socialtools.json');

// Ensure environment points to test database
process.env.DATA_FILE_PATH = TEST_DB_PATH;
process.env.DB_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';
if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET = 'test-e2e-secret-key-32b-deterministic-auth';
}

/**
 * Creates default database state structure.
 */
export function createDefaultDbState() {
  return {
    version: 1,
    users: {},
    transactions: [],
  };
}

/**
 * Initializes the isolated test database with given or default state.
 * @param {object} [initialState]
 */
export function setupTestDatabase(initialState = createDefaultDbState()) {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(initialState, null, 2), 'utf8');

  // Reset in-memory cache if db module is already loaded
  const globalObj = globalThis;
  if (globalObj.__socialtools_state !== undefined) {
    globalObj.__socialtools_state = null;
  }
  if (globalObj.__socialtools_db_state !== undefined) {
    globalObj.__socialtools_db_state = null;
  }
}

/**
 * Cleans up the test database file and any temporary files created during testing.
 */
export function teardownTestDatabase() {
  try {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  } catch {}

  // Clean any temporary files
  try {
    if (fs.existsSync(TEST_DATA_DIR)) {
      const files = fs.readdirSync(TEST_DATA_DIR);
      for (const file of files) {
        if (file.startsWith('test_socialtools.json') || file.includes('.tmp.')) {
          try {
            fs.unlinkSync(path.join(TEST_DATA_DIR, file));
          } catch {}
        }
      }
    }
  } catch {}

  const globalObj = globalThis;
  if (globalObj.__socialtools_state !== undefined) {
    globalObj.__socialtools_state = null;
  }
  if (globalObj.__socialtools_db_state !== undefined) {
    globalObj.__socialtools_db_state = null;
  }
}

/**
 * Reads the current state of the test database directly from disk.
 * @returns {object} Parsed database state
 */
export function getTestDatabaseState() {
  if (!fs.existsSync(TEST_DB_PATH)) {
    return createDefaultDbState();
  }
  const content = fs.readFileSync(TEST_DB_PATH, 'utf8');
  return JSON.parse(content);
}

/**
 * Writes an updated database state directly to disk.
 * @param {object} state
 */
export function writeTestDatabaseState(state) {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(TEST_DB_PATH, JSON.stringify(state, null, 2), 'utf8');
  const globalObj = globalThis;
  if (globalObj.__socialtools_state !== undefined) {
    globalObj.__socialtools_state = state;
  }
  if (globalObj.__socialtools_db_state !== undefined) {
    globalObj.__socialtools_db_state = state;
  }
}

/**
 * Generates an HMAC-SHA256 signed session token for testing.
 * @param {object} user - User profile data
 * @param {object} [options] - Options like expiresInSec or secret
 * @returns {string} Token formatted as `${base64url(payload)}.${base64url(signature)}`
 */
export function createTestSessionToken(user, options = {}) {
  const secret = options.secret || process.env.AUTH_SECRET || 'test-e2e-secret-key-32b-deterministic-auth';
  const iat = options.iat !== undefined ? options.iat : Math.floor(Date.now() / 1000);
  const expiresInSec = options.expiresInSec !== undefined ? options.expiresInSec : 30 * 24 * 60 * 60;
  const exp = options.exp !== undefined ? options.exp : iat + expiresInSec;

  const payload = {
    userId: user.userId || user.id || `usr_test_${Date.now()}`,
    email: (user.email || 'test@example.com').toLowerCase(),
    name: user.name || 'Test User',
    picture: user.picture,
    role: user.role || 'user',
    plan: user.plan || 'free',
    iat,
    exp,
  };

  const dataB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(dataB64).digest('base64url');
  return `${dataB64}.${signature}`;
}

/**
 * Generates an expired session token for boundary testing.
 */
export function createExpiredSessionToken(user, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  return createTestSessionToken(user, {
    ...options,
    iat: now - 7200,
    exp: now - 3600, // Expired 1 hour ago
  });
}

/**
 * Generates a tampered session token (corrupted signature) for boundary testing.
 */
export function createTamperedSessionToken(user) {
  const validToken = createTestSessionToken(user);
  const [dataB64, signature] = validToken.split('.');
  // Flip characters in signature
  const tamperedSig = signature.slice(0, -4) + 'xxxx';
  return `${dataB64}.${tamperedSig}`;
}

/**
 * Builds an authentic NextRequest instance for in-process route invocation.
 * @param {string} url - Target URL (e.g. 'http://localhost:3000/api/auth/me')
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object} [options.headers={}]
 * @param {object} [options.cookies={}]
 * @param {any} [options.body]
 * @returns {NextRequest}
 */
export function createMockRequest(url, options = {}) {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url.startsWith('/') ? '' : '/'}${url}`;
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  // Assemble Cookie header from options.cookies object if provided
  if (options.cookies && typeof options.cookies === 'object') {
    const existingCookie = headers.get('cookie') || '';
    const cookieParts = existingCookie ? [existingCookie] : [];
    for (const [key, val] of Object.entries(options.cookies)) {
      if (val !== undefined && val !== null) {
        cookieParts.push(`${key}=${val}`);
      }
    }
    if (cookieParts.length > 0) {
      headers.set('cookie', cookieParts.join('; '));
    }
  }

  const reqInit = {
    method,
    headers,
  };

  if (options.body && method !== 'GET' && method !== 'HEAD') {
    if (typeof options.body === 'object') {
      reqInit.body = JSON.stringify(options.body);
      if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
      }
    } else {
      reqInit.body = String(options.body);
    }
  }

  return new NextRequest(fullUrl, reqInit);
}

/**
 * Safely parses the JSON body of a NextResponse or Response.
 * @param {Response} response
 * @returns {Promise<any>}
 */
export async function parseJsonResponse(response) {
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse response as JSON: ${err.message}`);
  }
}

/**
 * Extracts Set-Cookie directives from response headers.
 * @param {Response} response
 * @returns {Record<string, { value: string, [attr: string]: any }>}
 */
export function parseResponseCookies(response) {
  const cookies = {};
  const setCookieHeader = response.headers.get('set-cookie');
  if (!setCookieHeader) return cookies;

  // Split multiple cookies if present
  const cookieStrings = setCookieHeader.split(/,(?=\s*[a-zA-Z0-9_-]+=)/);
  for (const cStr of cookieStrings) {
    const parts = cStr.trim().split(';');
    const [nameVal, ...attrs] = parts;
    const [name, ...valParts] = nameVal.split('=');
    const cookieName = name.trim();
    const cookieValue = valParts.join('=').trim();
    const cookieObj = { value: cookieValue };

    for (const attr of attrs) {
      const [attrName, attrVal] = attr.trim().split('=');
      const lower = attrName.toLowerCase();
      if (lower === 'httponly') cookieObj.httpOnly = true;
      else if (lower === 'secure') cookieObj.secure = true;
      else if (lower === 'samesite') cookieObj.sameSite = attrVal || true;
      else if (lower === 'max-age') cookieObj.maxAge = parseInt(attrVal, 10);
      else if (lower === 'path') cookieObj.path = attrVal;
    }
    cookies[cookieName] = cookieObj;
  }
  return cookies;
}
