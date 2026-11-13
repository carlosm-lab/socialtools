/**
 * Master E2E Test Runner for SocialTools Studio
 *
 * Runs opaque-box, in-process tests across Tiers 1-4 with zero live server dependencies.
 *
 * Usage:
 *   node tests/e2e/runner.mjs [options]
 *
 * Options:
 *   --tier=1|2|3|4     Run tests from a specific tier (can specify multiple or leave empty for all)
 *   --feature=F1..F5   Run tests for a specific feature area
 *   --filter=pattern   Run tests whose ID or title matches pattern
 *   --verbose          Print detailed logs and error traces
 *   --help             Show help message
 */

import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { setupTestDatabase, teardownTestDatabase } from './helpers/test-context.mjs';

// ANSI styling
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    tiers: [],
    features: [],
    filter: null,
    verbose: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg.startsWith('--tier=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val)) options.tiers.push(val);
    } else if (arg.startsWith('--feature=')) {
      options.features.push(arg.split('=')[1].toUpperCase());
    } else if (arg.startsWith('--filter=')) {
      options.filter = arg.split('=')[1].toLowerCase();
    }
  }

  return options;
}

function showHelp() {
  console.log(`
${BOLD}SocialTools Studio — Master E2E Test Runner${RESET}

${BOLD}Usage:${RESET}
  node tests/e2e/runner.mjs [options]

${BOLD}Options:${RESET}
  --tier=<1|2|3|4>    Filter by tier (Tier 1: Feature, Tier 2: Boundary, Tier 3: Cross, Tier 4: Journeys)
  --feature=<F1..F5>  Filter by feature area (F1: Auth/Credits, F2: Pricing/Paddle, F3: Legal, F4: Video, F5: Git)
  --filter=<string>   Filter tests by ID or title pattern
  --verbose           Enable verbose output and stack traces
  --help              Display this help message
`);
}

// Tier directories mapping
const TIER_DIRS = {
  1: 'tier1-feature-coverage',
  2: 'tier2-boundary-corner',
  3: 'tier3-cross-feature',
  4: 'tier4-real-world-workloads',
};

async function discoverTestFiles(targetTiers) {
  const e2eDir = path.resolve(process.cwd(), 'tests', 'e2e');
  const files = [];

  const tiersToScan = targetTiers.length > 0 ? targetTiers : [1, 2, 3, 4];

  for (const tier of tiersToScan) {
    const dirName = TIER_DIRS[tier];
    if (!dirName) continue;
    const tierPath = path.join(e2eDir, dirName);
    if (fs.existsSync(tierPath)) {
      const entries = fs.readdirSync(tierPath).filter((f) => f.endsWith('.test.mjs') || f.endsWith('.test.js'));
      for (const entry of entries) {
        files.push({
          tier,
          fileName: entry,
          filePath: path.join(tierPath, entry),
        });
      }
    }
  }

  return files;
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log(`\n${BOLD}${CYAN}======================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   SocialTools Studio — Master E2E Test Harness       ${RESET}`);
  console.log(`${BOLD}${CYAN}======================================================${RESET}\n`);

  console.log(`${GRAY}Node.js:${RESET} ${process.version}`);
  console.log(`${GRAY}Tiers:${RESET}   ${options.tiers.length > 0 ? options.tiers.join(', ') : 'All (1-4)'}`);
  if (options.features.length > 0) console.log(`${GRAY}Features:${RESET} ${options.features.join(', ')}`);
  if (options.filter) console.log(`${GRAY}Filter:${RESET}  ${options.filter}`);
  console.log('');

  // Global Setup
  setupTestDatabase();

  const testFiles = await discoverTestFiles(options.tiers);

  if (testFiles.length === 0) {
    console.log(`${YELLOW}No test files found matching criteria.${RESET}\n`);
    teardownTestDatabase();
    process.exit(0);
  }

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    failures: [],
  };

  const startTime = Date.now();

  for (const fileInfo of testFiles) {
    const fileUrl = pathToFileURL(fileInfo.filePath).href;
    console.log(`${BOLD}Suite:${RESET} ${fileInfo.fileName} ${GRAY}(Tier ${fileInfo.tier})${RESET}`);

    let fileModule;
    try {
      fileModule = await import(fileUrl);
    } catch (err) {
      console.log(`  ${RED}[ERROR LOADING SUITE]${RESET} ${err.message}`);
      if (options.verbose) console.error(err.stack);
      results.failed++;
      results.total++;
      results.failures.push({
        id: fileInfo.fileName,
        title: 'Module load error',
        error: err.message,
        stack: err.stack,
      });
      continue;
    }

    const tests = fileModule.tests || [];
    if (!Array.isArray(tests) || tests.length === 0) {
      console.log(`  ${YELLOW}[SKIP] No tests exported in suite${RESET}`);
      continue;
    }

    for (const testCase of tests) {
      // Filter by feature
      if (options.features.length > 0) {
        const feat = (testCase.feature || '').toUpperCase();
        if (!options.features.includes(feat)) {
          results.skipped++;
          continue;
        }
      }

      // Filter by pattern
      if (options.filter) {
        const idMatch = (testCase.id || '').toLowerCase().includes(options.filter);
        const titleMatch = (testCase.title || '').toLowerCase().includes(options.filter);
        if (!idMatch && !titleMatch) {
          results.skipped++;
          continue;
        }
      }

      results.total++;
      const testStart = Date.now();

      try {
        if (typeof testCase.run !== 'function') {
          throw new Error('Test case has no executable run() function');
        }
        await testCase.run();
        const duration = Date.now() - testStart;
        results.passed++;
        console.log(`  ${GREEN}✓ [PASS]${RESET} ${BOLD}${testCase.id}:${RESET} ${testCase.title} ${GRAY}(${duration}ms)${RESET}`);
      } catch (err) {
        const duration = Date.now() - testStart;
        results.failed++;
        console.log(`  ${RED}✗ [FAIL]${RESET} ${BOLD}${testCase.id}:${RESET} ${testCase.title} ${GRAY}(${duration}ms)${RESET}`);
        console.log(`     ${RED}Error: ${err.message}${RESET}`);
        if (options.verbose && err.stack) {
          console.log(`     ${GRAY}${err.stack.split('\n').slice(1, 4).join('\n     ')}${RESET}`);
        }
        results.failures.push({
          id: testCase.id,
          title: testCase.title,
          error: err.message,
          stack: err.stack,
        });
      }
    }

    console.log('');
  }

  // Global Teardown
  teardownTestDatabase();

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`${BOLD}${CYAN}======================================================${RESET}`);
  console.log(`${BOLD}Summary:${RESET}`);
  console.log(`  Total:   ${BOLD}${results.total}${RESET}`);
  console.log(`  Passed:  ${GREEN}${BOLD}${results.passed}${RESET}`);
  console.log(`  Failed:  ${results.failed > 0 ? RED : GRAY}${BOLD}${results.failed}${RESET}`);
  if (results.skipped > 0) console.log(`  Skipped: ${YELLOW}${BOLD}${results.skipped}${RESET}`);
  console.log(`  Time:    ${totalDuration}s`);
  console.log(`${BOLD}${CYAN}======================================================${RESET}\n`);

  if (results.failed > 0) {
    console.log(`${RED}${BOLD}Failed Tests (${results.failures.length}):${RESET}`);
    for (const fail of results.failures) {
      console.log(`  - ${RED}${fail.id}${RESET}: ${fail.title}`);
      console.log(`    ${fail.error}`);
    }
    console.log('');
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}ALL TESTS PASSED SUCCESSFULLY!${RESET}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${RED}Runner fatal crash:${RESET}`, err);
  process.exit(1);
});
