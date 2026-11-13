/**
 * DOM Inspector Helper for E2E Tests
 * Analyzes static JSX/TSX source code and component markup to verify design system compliance:
 * - Canvas: Pale Mint #cfe8e1
 * - Surfaces / Cards: Clean white #ffffff (or bg-white)
 * - Primary buttons / text: Midnight Navy #002941
 * - Fine borders / dividers: #b8d8cf
 * - Strict prohibition: ZERO nested cards
 * - Strict prohibition: ZERO rounded-full pill badges
 * - Strict prohibition: ZERO neon gradients or dark mode
 */

import fs from 'node:fs';
import path from 'node:path';

export const DESIGN_TOKENS = {
  PALE_MINT: '#cfe8e1',
  WHITE: '#ffffff',
  MIDNIGHT_NAVY: '#002941',
  MINT_BORDER: '#b8d8cf',
};

/**
 * Checks whether the source code contains expected design tokens.
 * @param {string} sourceCode
 * @param {string[]} expectedTokens - Array of token hexes or class substrings (e.g. ['#cfe8e1', '#002941'])
 * @returns {{ allPresent: boolean, missing: string[] }}
 */
export function checkDesignTokens(sourceCode, expectedTokens = ['#cfe8e1', '#002941', '#b8d8cf']) {
  const missing = [];
  const lowerCode = sourceCode.toLowerCase();

  for (const token of expectedTokens) {
    const normalized = token.toLowerCase();
    if (!lowerCode.includes(normalized)) {
      missing.push(token);
    }
  }

  return {
    allPresent: missing.length === 0,
    missing,
  };
}

/**
 * Checks for prohibited rounded-full pill badges/chips/tags.
 * Allows rounded-md, rounded-lg, rounded-xl, rounded-2xl, but rounded-full is forbidden on badges/chips.
 * @param {string} sourceCode
 * @returns {{ passed: boolean, occurrences: string[] }}
 */
export function checkZeroRoundedFullPillBadges(sourceCode) {
  // Regex to look for rounded-full in class names
  const regex = /className\s*=\s*["'`][^"'`]*rounded-full[^"'`]*["'`]/g;
  const matches = sourceCode.match(regex) || [];

  return {
    passed: matches.length === 0,
    occurrences: matches,
  };
}

/**
 * Checks for prohibited nested card patterns.
 * Identifies if a container with card borders/surface nests another child container with card styling.
 * @param {string} sourceCode
 * @returns {{ passed: boolean, nestingFound: boolean, message: string }}
 */
export function checkZeroNestedCards(sourceCode) {
  // Common nested card signals:
  // 1. Explicit comment "ZERO nested cards" or verification of flat structure
  // 2. Checking if within a card container (e.g. rounded-2xl border border-[#b8d8cf] bg-white)
  //    there is an inner div that also defines bg-white border border-[#b8d8cf] rounded-
  const cardPattern = /(?:bg-white|bg-\[#ffffff\])[^>]*border(?:-[^>]+)?\s*rounded-(?:xl|2xl|lg)/gi;
  const matches = [...sourceCode.matchAll(cardPattern)];

  // If there are multiple card containers, verify if one is nested inside the other in the AST or string
  let nestingFound = false;
  if (matches.length > 1) {
    // Check if one card definition occurs between the opening and closing tag of another
    // Simplified heuristic: check if any element has class "bg-white" or "bg-[#ffffff]" with "border" inside another card's content
    const nestedRegex = /<div[^>]*className=["'][^"']*(?:rounded-2xl|rounded-xl)[^"']*border[^"']*["'][^>]*>[\s\S]*?<div[^>]*className=["'][^"']*(?:rounded-2xl|rounded-xl|rounded-lg)[^"']*border[^"']*(?:bg-white|bg-\[#ffffff\])/i;
    if (nestedRegex.test(sourceCode)) {
      nestingFound = true;
    }
  }

  return {
    passed: !nestingFound,
    nestingFound,
    message: nestingFound
      ? 'Nested card containers detected violating the flat design standard.'
      : 'Zero nested cards verified.',
  };
}

/**
 * Checks for absence of prohibited neon gradients or dark mode classes.
 * @param {string} sourceCode
 * @returns {{ passed: boolean, violations: string[] }}
 */
export function checkNoGradientsOrDarkTheme(sourceCode) {
  const violations = [];
  const lower = sourceCode.toLowerCase();

  // Prohibited gradient classes
  const gradientPatterns = ['bg-gradient-to-', 'from-purple-', 'to-pink-', 'from-blue-600', 'bg-zinc-900', 'bg-gray-900', 'dark:'];
  for (const pat of gradientPatterns) {
    if (lower.includes(pat)) {
      violations.push(pat);
    }
  }

  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Runs the full suite of design system checks on a target component file.
 * @param {string} relativeFilePath
 * @returns {{ pass: boolean, details: object }}
 */
export function inspectComponentFile(relativeFilePath) {
  const fullPath = path.isAbsolute(relativeFilePath)
    ? relativeFilePath
    : path.join(process.cwd(), relativeFilePath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(`Component file not found: ${fullPath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  const tokens = checkDesignTokens(content, ['#cfe8e1', '#002941', '#b8d8cf']);
  const pills = checkZeroRoundedFullPillBadges(content);
  const nested = checkZeroNestedCards(content);
  const gradients = checkNoGradientsOrDarkTheme(content);

  const pass = tokens.allPresent && pills.passed && nested.passed && gradients.passed;

  return {
    pass,
    filePath: relativeFilePath,
    tokens,
    pills,
    nested,
    gradients,
  };
}
