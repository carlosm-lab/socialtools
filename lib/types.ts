/**
 * Core type definitions for SocialTools Studio
 * Covers User accounts, Credit Transactions, Subscriptions, Persistence, and Entitlements Ledger.
 */

export type UserRole = 'user' | 'admin';

export type UserPlan = 'free' | 'creator' | 'agency' | 'unlimited';

export type CreditTransactionType =
  | 'free_grant'        // 1 free video credit granted on first login
  | 'paddle_purchase'   // Video credits bought via Paddle ($1/unit, min 5)
  | 'video_processed'   // 1 credit consumed for video metadata cleaning
  | 'admin_grant'       // Manual or automatic admin unlimited credit allocation
  | 'refund';           // Administrative refund

export interface User {
  id: string;                         // e.g. "usr_1029384756..."
  email: string;                      // Normalized lowercase email
  name: string;                       // Google displayName or fallback
  picture?: string;                   // Google avatar image URL
  googleId: string;                   // Google OAuth "sub" claim
  role: UserRole;                     // 'user' | 'admin'
  plan: UserPlan;                     // 'free' | 'creator' | 'agency' | 'unlimited'
  credits: number;                    // Integer video credits balance
  subscriptionId?: string | null;     // Paddle subscription ID (sub_...)
  subscriptionPlan?: string | null;   // e.g. 'creator_annual' ($79/yr)
  subscriptionStatus?: string | null; // 'active', 'past_due', 'canceled'
  createdAt: string;                  // ISO 8601 string
  lastLoginAt: string;                // ISO 8601 string
}

export interface CreditTransaction {
  id: string;                         // e.g. "tx_1731300000000_a1b2c3d4"
  userId: string;                     // Foreign key referencing User.id
  type: CreditTransactionType;
  amount: number;                     // e.g. +1, +5, -1
  balanceAfter: number;               // User credits balance after this transaction
  description: string;                // Human-readable transaction summary
  paddleTransactionId?: string | null;// Paddle txn_... ID if applicable
  createdAt: string;                  // ISO 8601 string
}

export interface DatabaseState {
  version: number;
  users: Record<string, User>;        // Keyed by User.id
  transactions: CreditTransaction[];  // Chronological transaction log
}

export interface UserCreditsInfo {
  credits: number;
  plan: UserPlan;
  isAdmin: boolean;
  hasUnlimitedAccess: boolean;
}

export interface DeductCreditResult {
  success: boolean;
  remaining: number;
  bypassed?: boolean;
  error?: string;
}

export interface CreateUserInput {
  email: string;
  name?: string;
  picture?: string;
  googleId: string;
  role?: UserRole;
  plan?: UserPlan;
  credits?: number;
}

export type UpdateUserInput = Partial<Omit<User, 'id' | 'createdAt'>>;

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  plan: UserPlan;
}

export interface SessionPayload extends SessionUser {
  iat: number; // Issued at timestamp (epoch seconds)
  exp: number; // Expiration timestamp (epoch seconds)
}

/**
 * Dual-layer signed httpOnly cookie ledger for Vercel serverless cold start resilience
 */
export interface EntitlementsCookiePayload {
  sub: string;                // User googleId or internal id
  email: string;              // Normalized lowercase email
  credits: number;            // Current credit balance
  trialGranted: boolean;      // True if free trial has ever been granted
  plan: UserPlan;             // User subscription / plan tier
  processedTxIds?: string[];  // Dedup array to prevent double-crediting
  iat?: number;               // Issued at
  exp?: number;               // Expiration
}
