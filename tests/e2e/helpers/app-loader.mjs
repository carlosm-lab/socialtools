/**
 * App Loader Helper for E2E Tests
 * Uses jiti to load TypeScript route handlers, components, and library modules in Node.js v25.
 */

import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const createJiti = require('jiti');

// Initialize jiti instance with workspace root as base and path alias support
const jiti = createJiti(process.cwd(), {
  interopDefault: true,
  esmResolve: true,
  cache: false, // Ensure fresh loads between tests when files mutate
  alias: {
    '@': process.cwd(),
  },
});

/**
 * Resolves a file path relative to workspace root if not absolute.
 */
export function resolveWorkspacePath(relativeOrAbsolutePath) {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }
  return path.join(process.cwd(), relativeOrAbsolutePath);
}

/**
 * Loads any TypeScript or JavaScript module in the workspace.
 * @param {string} moduleRelativePath - Path relative to workspace root (e.g. 'lib/db.ts')
 * @returns {any} Exported module contents
 */
export function loadModule(moduleRelativePath) {
  const fullPath = resolveWorkspacePath(moduleRelativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`[app-loader] Module not found at: ${fullPath}`);
  }
  return jiti(fullPath);
}

/**
 * Loads an App Router route handler module.
 * @param {string} routeRelativePath - e.g. 'app/api/auth/google/route.ts'
 * @returns {Record<string, Function>} Route exports (GET, POST, etc.)
 */
export function loadRoute(routeRelativePath) {
  const fullPath = resolveWorkspacePath(routeRelativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`[app-loader] Route handler not found at: ${fullPath}`);
  }
  return jiti(fullPath);
}

/**
 * Reads raw source code of a workspace file for static inspection, regex checking, or AST auditing.
 * @param {string} fileRelativePath - e.g. 'components/PricingTable.tsx'
 * @returns {string} Raw file text content
 */
export function loadSourceFile(fileRelativePath) {
  const fullPath = resolveWorkspacePath(fileRelativePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`[app-loader] File not found: ${fullPath}`);
  }
  return fs.readFileSync(fullPath, 'utf8');
}

/**
 * Checks whether a given workspace file exists.
 * @param {string} fileRelativePath
 * @returns {boolean}
 */
export function fileExists(fileRelativePath) {
  const fullPath = resolveWorkspacePath(fileRelativePath);
  return fs.existsSync(fullPath);
}
