/**
 * Atomic File-Based Database Persistence Layer for SocialTools Studio
 * Target: ./data/socialtools.json (or /tmp/socialtools-data/socialtools.json on Vercel)
 * 
 * Features:
 * - Vercel Serverless EROFS Guardrail with graceful fallback to /tmp and in-memory cache
 * - Thread-safe in-memory promise mutex queue (prevents lost-update race conditions)
 * - Atomic write-and-rename with Windows transient lock retry
 * - Global singleton caching resilient to Next.js HMR development reloads
 * - Automatic 1 free credit grant on user signup (free_grant transaction)
 * - Automatic permanent elevation of negocios.axkarl@gmail.com to unlimited admin
 * - Dual-layer reconciliation with signed st_entitlements cookie ledger
 * - Non-negative credit balance enforcement & paid subscription bypass
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import crypto from 'crypto';
import {
  User,
  CreditTransaction,
  DatabaseState,
  UserCreditsInfo,
  DeductCreditResult,
  CreateUserInput,
  UpdateUserInput,
  UserPlan,
  UserRole,
  EntitlementsCookiePayload,
} from './types';

export const ADMIN_EMAIL = 'negocios.axkarl@gmail.com';
export const FREE_WELCOME_CREDITS = 1;
export const ADMIN_UNLIMITED_CREDITS = 999999;

/**
 * Resolves the persistent data directory according to environment:
 * Explicit DATA_DIR > Vercel Serverless /tmp > Local cwd/data
 */
function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return process.env.DATA_DIR;
  }
  if (process.env.VERCEL) {
    return path.join('/tmp', 'socialtools-data');
  }
  return path.join(process.cwd(), 'data');
}

let activeDataDir = resolveDataDir();
let activeDataFile = process.env.DATA_FILE_PATH || path.join(activeDataDir, 'socialtools.json');

// --- HMR Global Singleton Container ---
interface DbGlobal {
  __socialtools_state?: DatabaseState | null;
  __socialtools_lock?: Promise<unknown>;
  __socialtools_fs_read_only?: boolean;
}

const dbGlobal = globalThis as unknown as DbGlobal;
if (!dbGlobal.__socialtools_lock) {
  dbGlobal.__socialtools_lock = Promise.resolve();
}

/**
 * Serializes all mutating database operations through an in-memory Promise queue.
 */
export function withLock<T>(action: () => Promise<T>): Promise<T> {
  const current = dbGlobal.__socialtools_lock || Promise.resolve();
  const next = current.then(() => action(), () => action());
  dbGlobal.__socialtools_lock = next.then(() => {}, () => {});
  return next;
}

function createDefaultState(): DatabaseState {
  return {
    version: 1,
    users: {},
    transactions: [],
  };
}

/**
 * Windows-resilient atomic rename with exponential retry backoff.
 */
async function safeRename(tempPath: string, targetPath: string, retries = 5, delayMs = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await fs.rename(tempPath, targetPath);
      return;
    } catch (err: unknown) {
      const error = err as { code?: string };
      if ((error.code === 'EPERM' || error.code === 'EBUSY') && i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Ensures data directory exists with EROFS protection and fallback to /tmp.
 */
function ensureDataDir(): void {
  if (dbGlobal.__socialtools_fs_read_only) return;

  try {
    if (!existsSync(activeDataDir)) {
      mkdirSync(activeDataDir, { recursive: true });
    }
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'EROFS' || error.code === 'EACCES') {
      // Fallback to /tmp in serverless read-only contexts
      const fallbackDir = path.join('/tmp', 'socialtools-data');
      try {
        if (!existsSync(fallbackDir)) {
          mkdirSync(fallbackDir, { recursive: true });
        }
        activeDataDir = fallbackDir;
        activeDataFile = path.join(activeDataDir, 'socialtools.json');
        return;
      } catch {
        // Mark filesystem as read-only, operate in memory cache
        dbGlobal.__socialtools_fs_read_only = true;
      }
    }
  }
}

/**
 * Reads database state from disk or initializes default.
 */
async function readStateFromDisk(): Promise<DatabaseState> {
  ensureDataDir();

  if (dbGlobal.__socialtools_fs_read_only) {
    return dbGlobal.__socialtools_state || createDefaultState();
  }

  if (!existsSync(activeDataFile)) {
    const initial = createDefaultState();
    await writeStateToDisk(initial);
    return initial;
  }

  try {
    const content = await fs.readFile(activeDataFile, 'utf8');
    const parsed = JSON.parse(content) as DatabaseState;
    if (!parsed || typeof parsed !== 'object' || !parsed.users) {
      throw new Error('Formato de base de datos no válido');
    }
    return parsed;
  } catch (err) {
    console.error('[DB] Error al leer socialtools.json, creando respaldo:', err);
    try {
      if (existsSync(activeDataFile)) {
        await fs.copyFile(activeDataFile, `${activeDataFile}.corrupted.${Date.now()}`);
      }
    } catch {}
    const initial = createDefaultState();
    await writeStateToDisk(initial);
    return initial;
  }
}

/**
 * Flushes state atomically to disk via a temporary file + rename.
 * Gracefully handles EROFS by falling back to /tmp or memory.
 */
async function writeStateToDisk(state: DatabaseState): Promise<void> {
  dbGlobal.__socialtools_state = state;

  if (dbGlobal.__socialtools_fs_read_only) {
    return;
  }

  ensureDataDir();

  const tempFile = path.join(
    activeDataDir,
    `socialtools.json.tmp.${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  );
  const jsonContent = JSON.stringify(state, null, 2);

  try {
    await fs.writeFile(tempFile, jsonContent, 'utf8');
    await safeRename(tempFile, activeDataFile);
  } catch (err: unknown) {
    const error = err as { code?: string };
    try {
      if (existsSync(tempFile)) {
        await fs.unlink(tempFile);
      }
    } catch {}

    if (error.code === 'EROFS' || error.code === 'EACCES') {
      // If primary path hit EROFS, retry once with /tmp
      if (!activeDataDir.startsWith('/tmp')) {
        const fallbackDir = path.join('/tmp', 'socialtools-data');
        try {
          if (!existsSync(fallbackDir)) {
            mkdirSync(fallbackDir, { recursive: true });
          }
          activeDataDir = fallbackDir;
          activeDataFile = path.join(activeDataDir, 'socialtools.json');
          const fallbackTemp = path.join(
            activeDataDir,
            `socialtools.json.tmp.${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
          );
          await fs.writeFile(fallbackTemp, jsonContent, 'utf8');
          await safeRename(fallbackTemp, activeDataFile);
          return;
        } catch {
          // If fallback fails, operate in memory
          dbGlobal.__socialtools_fs_read_only = true;
          return;
        }
      }
      dbGlobal.__socialtools_fs_read_only = true;
      return;
    }
    throw err;
  }
}

/**
 * Retrieves the current in-memory database state.
 */
export async function getState(): Promise<DatabaseState> {
  if (dbGlobal.__socialtools_state) {
    return dbGlobal.__socialtools_state;
  }
  const state = await readStateFromDisk();
  dbGlobal.__socialtools_state = state;
  return state;
}

/**
 * Helper to identify administrator accounts.
 */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

// ============================================================================
// Public Interface Contracts
// ============================================================================

/**
 * Finds a user by email (case-insensitive).
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const state = await getState();
  const user = Object.values(state.users).find((u) => u.email.toLowerCase() === normalized);
  if (!user) return null;

  // Auto-elevate admin if needed
  if (isAdminEmail(user.email)) {
    if (user.role !== 'admin' || user.plan !== 'unlimited' || user.credits < ADMIN_UNLIMITED_CREDITS) {
      return updateUser(user.id, {
        role: 'admin',
        plan: 'unlimited',
        credits: ADMIN_UNLIMITED_CREDITS,
      });
    }
  }

  return user;
}

/**
 * Finds a user by internal ID.
 */
export async function getUserById(id: string): Promise<User | null> {
  const state = await getState();
  const user = state.users[id] || null;
  if (!user) return null;

  if (isAdminEmail(user.email)) {
    if (user.role !== 'admin' || user.plan !== 'unlimited' || user.credits < ADMIN_UNLIMITED_CREDITS) {
      return updateUser(user.id, {
        role: 'admin',
        plan: 'unlimited',
        credits: ADMIN_UNLIMITED_CREDITS,
      });
    }
  }

  return user;
}

/**
 * Creates a new user or returns existing with refreshed login timestamp.
 * Automatically grants 1 free video credit to standard users and logs welcome tx.
 * Automatically gives unlimited privileges to negocios.axkarl@gmail.com.
 */
export async function createUser(data: CreateUserInput): Promise<User> {
  return withLock(async () => {
    const state = await getState();
    const normalizedEmail = data.email.trim().toLowerCase();

    // If user already exists, update lastLoginAt and return
    const existing = Object.values(state.users).find(
      (u) => u.email.toLowerCase() === normalizedEmail
    );
    if (existing) {
      existing.lastLoginAt = new Date().toISOString();
      if (data.name) existing.name = data.name;
      if (data.picture) existing.picture = data.picture;
      if (isAdminEmail(normalizedEmail)) {
        existing.role = 'admin';
        existing.plan = 'unlimited';
        existing.credits = ADMIN_UNLIMITED_CREDITS;
      }
      await writeStateToDisk(state);
      return existing;
    }

    const isAdmin = isAdminEmail(normalizedEmail);
    const now = new Date().toISOString();
    const userId = `usr_${data.googleId || crypto.randomUUID().replace(/-/g, '')}`;

    const initialCredits = isAdmin
      ? ADMIN_UNLIMITED_CREDITS
      : data.credits !== undefined
      ? data.credits
      : FREE_WELCOME_CREDITS;

    const initialPlan: UserPlan = isAdmin
      ? 'unlimited'
      : data.plan || 'free';

    const initialRole: UserRole = isAdmin
      ? 'admin'
      : data.role || 'user';

    const newUser: User = {
      id: userId,
      email: normalizedEmail,
      name: data.name || normalizedEmail.split('@')[0],
      picture: data.picture,
      googleId: data.googleId,
      role: initialRole,
      plan: initialPlan,
      credits: initialCredits,
      subscriptionId: null,
      subscriptionPlan: null,
      subscriptionStatus: null,
      createdAt: now,
      lastLoginAt: now,
    };

    state.users[userId] = newUser;

    // Log initial grant transaction
    const welcomeTx: CreditTransaction = {
      id: `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId,
      type: isAdmin ? 'admin_grant' : 'free_grant',
      amount: initialCredits,
      balanceAfter: initialCredits,
      description: isAdmin
        ? 'Acceso ilimitado de administrador'
        : 'Crédito de bienvenida (Prueba gratuita)',
      paddleTransactionId: null,
      createdAt: now,
    };
    state.transactions.push(welcomeTx);

    await writeStateToDisk(state);
    return newUser;
  });
}

/**
 * Updates an existing user record.
 */
export async function updateUser(id: string, data: UpdateUserInput): Promise<User> {
  return withLock(async () => {
    const state = await getState();
    const user = state.users[id];
    if (!user) {
      throw new Error(`Usuario no encontrado con id: ${id}`);
    }

    const normalizedEmail = (data.email || user.email).trim().toLowerCase();
    const isAdmin = isAdminEmail(normalizedEmail);

    const updated: User = {
      ...user,
      ...data,
      email: normalizedEmail,
      id: user.id, // Preserved
      createdAt: user.createdAt, // Preserved
      role: isAdmin ? 'admin' : (data.role || user.role),
      plan: isAdmin ? 'unlimited' : (data.plan || user.plan),
      credits: isAdmin ? ADMIN_UNLIMITED_CREDITS : (data.credits !== undefined ? data.credits : user.credits),
      lastLoginAt: data.lastLoginAt || new Date().toISOString(),
    };

    state.users[id] = updated;
    await writeStateToDisk(state);
    return updated;
  });
}

/**
 * Returns user credit balance, plan, and admin/unlimited privilege status.
 */
export async function getUserCredits(userId: string): Promise<UserCreditsInfo> {
  const user = await getUserById(userId);
  if (!user) {
    return {
      credits: 0,
      plan: 'free',
      isAdmin: false,
      hasUnlimitedAccess: false,
    };
  }

  const isAdmin = user.role === 'admin' || isAdminEmail(user.email);
  const hasUnlimitedAccess =
    isAdmin ||
    user.plan === 'unlimited' ||
    user.plan === 'creator' ||
    user.plan === 'agency';

  return {
    credits: isAdmin ? ADMIN_UNLIMITED_CREDITS : user.credits,
    plan: user.plan,
    isAdmin,
    hasUnlimitedAccess,
  };
}

/**
 * Deducts 1 video processing credit atomically.
 * Bypasses deduction for admin and paid subscribers (creator, agency, unlimited).
 * Prevents negative credit balance for free users.
 */
export async function deductCredit(
  userId: string,
  reason = 'Procesamiento de video'
): Promise<DeductCreditResult> {
  return withLock(async () => {
    const state = await getState();
    const user = state.users[userId];
    if (!user) {
      return { success: false, remaining: 0, error: 'Usuario no encontrado' };
    }

    const isAdmin = user.role === 'admin' || isAdminEmail(user.email);
    const isUnlimitedPlan =
      user.plan === 'unlimited' ||
      user.plan === 'creator' ||
      user.plan === 'agency';

    // Bypassed for admin and subscription plans
    if (isAdmin || isUnlimitedPlan) {
      return {
        success: true,
        remaining: isAdmin ? ADMIN_UNLIMITED_CREDITS : user.credits,
        bypassed: true,
      };
    }

    // Check balance for free tier / pay-per-use users
    if (user.credits < 1) {
      return {
        success: false,
        remaining: user.credits,
        error: 'Saldo de créditos insuficiente. Recarga créditos o suscríbete a un plan.',
      };
    }

    user.credits -= 1;

    const tx: CreditTransaction = {
      id: `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: user.id,
      type: 'video_processed',
      amount: -1,
      balanceAfter: user.credits,
      description: reason,
      paddleTransactionId: null,
      createdAt: new Date().toISOString(),
    };
    state.transactions.push(tx);

    await writeStateToDisk(state);
    return {
      success: true,
      remaining: user.credits,
      bypassed: false,
    };
  });
}

/**
 * Adds purchased or granted credits to a user balance.
 */
export async function addCredits(
  userId: string,
  amount: number,
  paddleTxId?: string
): Promise<User> {
  if (amount <= 0 || !Number.isInteger(amount)) {
    throw new Error(`La cantidad de créditos debe ser un entero positivo, recibido: ${amount}`);
  }

  return withLock(async () => {
    const state = await getState();
    const user = state.users[userId];
    if (!user) {
      throw new Error(`Usuario no encontrado con id: ${userId}`);
    }

    if (paddleTxId) {
      const existingTx = state.transactions.find(
        (t) => t.userId === user.id && t.paddleTransactionId === paddleTxId
      );
      if (existingTx) {
        return user;
      }
    }

    user.credits += amount;

    const tx: CreditTransaction = {
      id: `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: user.id,
      type: paddleTxId ? 'paddle_purchase' : 'admin_grant',
      amount,
      balanceAfter: user.credits,
      description: paddleTxId
        ? `Compra Paddle de ${amount} créditos`
        : `Recarga manual de ${amount} créditos`,
      paddleTransactionId: paddleTxId || null,
      createdAt: new Date().toISOString(),
    };
    state.transactions.push(tx);

    await writeStateToDisk(state);
    return user;
  });
}

/**
 * Records an arbitrary credit transaction.
 */
export async function logTransaction(
  txData: Omit<CreditTransaction, 'id' | 'createdAt'>
): Promise<CreditTransaction> {
  return withLock(async () => {
    const state = await getState();
    const tx: CreditTransaction = {
      ...txData,
      id: `tx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      paddleTransactionId: txData.paddleTransactionId || null,
      createdAt: new Date().toISOString(),
    };
    state.transactions.push(tx);
    await writeStateToDisk(state);
    return tx;
  });
}

/**
 * Retrieves transaction logs for a user, sorted descending by date.
 */
export async function getUserTransactions(
  userId: string,
  limit = 50
): Promise<CreditTransaction[]> {
  const state = await getState();
  return state.transactions
    .filter((t) => t.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

/**
 * Dual-layer reconciliation: Reconciles user record between local store
 * and HMAC-signed st_entitlements cookie ledger across Vercel serverless instances.
 */
export async function reconcileUserWithEntitlements(
  ledger: EntitlementsCookiePayload,
  profileFallback?: { name?: string; picture?: string }
): Promise<User> {
  return withLock(async () => {
    const state = await getState();
    const normalizedEmail = ledger.email.trim().toLowerCase();
    const isAdmin = isAdminEmail(normalizedEmail);

    let user = Object.values(state.users).find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      // Reconstruct user in local cache from signed cookie ledger
      const userId = `usr_${ledger.sub || crypto.randomUUID().replace(/-/g, '')}`;
      const now = new Date().toISOString();
      const credits = isAdmin ? ADMIN_UNLIMITED_CREDITS : ledger.credits;
      const plan: UserPlan = isAdmin ? 'unlimited' : ledger.plan;
      const role: UserRole = isAdmin ? 'admin' : 'user';

      user = {
        id: userId,
        email: normalizedEmail,
        name: profileFallback?.name || normalizedEmail.split('@')[0],
        picture: profileFallback?.picture,
        googleId: ledger.sub,
        role,
        plan,
        credits,
        subscriptionId: null,
        subscriptionPlan: null,
        subscriptionStatus: null,
        createdAt: now,
        lastLoginAt: now,
      };
      state.users[userId] = user;
      await writeStateToDisk(state);
      return user;
    }

    // If both exist, merge conservatively (keep highest paid status / reconcile credits)
    let needsSave = false;
    if (isAdmin) {
      if (user.role !== 'admin' || user.plan !== 'unlimited' || user.credits < ADMIN_UNLIMITED_CREDITS) {
        user.role = 'admin';
        user.plan = 'unlimited';
        user.credits = ADMIN_UNLIMITED_CREDITS;
        needsSave = true;
      }
    } else {
      // If ledger has newer credits or different plan
      if (ledger.plan !== 'free' && user.plan === 'free') {
        user.plan = ledger.plan;
        needsSave = true;
      }
      if (typeof ledger.credits === 'number' && ledger.credits !== user.credits) {
        // Use the lower credit balance if video was consumed, or higher if purchased
        user.credits = ledger.credits;
        needsSave = true;
      }
    }

    if (needsSave) {
      await writeStateToDisk(state);
    }

    return user;
  });
}

/**
 * Testing utility to reset or seed state.
 */
export async function __resetDbForTesting(freshState?: DatabaseState): Promise<void> {
  return withLock(async () => {
    const state = freshState || createDefaultState();
    await writeStateToDisk(state);
    dbGlobal.__socialtools_state = state;
  });
}
