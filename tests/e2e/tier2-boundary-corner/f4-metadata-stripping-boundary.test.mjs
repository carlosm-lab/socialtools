/**
 * Tier 2 — Boundary & Corner Cases: Video Metadata Stripping
 * Tests T2-F4-01 to T2-F4-05
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadSourceFile } from '../helpers/app-loader.mjs';
import { inspectComponentFile, checkZeroRoundedFullPillBadges, checkZeroNestedCards } from '../helpers/dom-inspector.mjs';
import { runFFmpegBitexactClean } from '../helpers/ffmpeg-verifier.mjs';

export const tests = [
  {
    id: 'T2-F4-01',
    feature: 'F4',
    tier: 2,
    title: 'Mode 2 Deep Anti-SynthID execution is blocked with clear warning if user lacks active Creator/Agency plan or credits',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      // Verify gating guard on Mode 2
      assert.ok(
        cleanerSrc.includes("mode === 'deep' && !licenseFeatures?.modeDeepAntiSynthID"),
        'useFFmpegCleaner must guard Mode 2 execution behind modeDeepAntiSynthID license feature'
      );
      assert.ok(
        cleanerSrc.includes('Anti-SynthID requiere una licencia Creator o Agency activa') ||
        cleanerSrc.includes('requiere una licencia'),
        'useFFmpegCleaner must set user-friendly warning message when Mode 2 is blocked'
      );
    },
  },

  {
    id: 'T2-F4-02',
    feature: 'F4',
    tier: 2,
    title: 'Mode 3 Multi-Variant Spoofer execution is blocked with clear warning if user lacks active Agency plan or admin role',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      // Verify gating guard on Mode 3
      assert.ok(
        cleanerSrc.includes("mode === 'spoofer' && !licenseFeatures?.modeMultiVariant"),
        'useFFmpegCleaner must guard Mode 3 execution behind modeMultiVariant license feature'
      );
      assert.ok(
        cleanerSrc.includes('Multi-Variante requiere una licencia Agency activa') ||
        cleanerSrc.includes('requiere una licencia'),
        'useFFmpegCleaner must set user-friendly warning message when Mode 3 is blocked'
      );
    },
  },

  {
    id: 'T2-F4-03',
    feature: 'F4',
    tier: 2,
    title: 'FFmpeg pipeline gracefully handles videos without an audio track (-map 0:a?) without failing the video strip',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      // 1. Verify all 3 modes use optional audio stream mapping: -map 0:a?
      const audioMappings = cleanerSrc.match(/'0:a\?'/g) || [];
      assert.ok(
        audioMappings.length >= 3,
        `Expected at least 3 occurrences of '0:a?' (one per mode), found ${audioMappings.length}`
      );

      // 2. Real native test: create silent synthetic video, run bitexact cleaner, assert success
      const tempSilentInput = path.join(process.cwd(), `test_silent_in_${Date.now()}.mp4`);
      const tempSilentOutput = path.join(process.cwd(), `test_silent_out_${Date.now()}.mp4`);

      try {
        // Generate a 1-second silent video (video stream only, no audio)
        execFileSync('ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', 'color=c=black:s=160x120:d=1',
          '-c:v', 'libx264',
          '-t', '1',
          '-an', // strictly no audio
          tempSilentInput,
        ], { stdio: 'pipe' });

        assert.ok(fs.existsSync(tempSilentInput), 'Silent test video fixture must be generated');

        // Run bitexact pipeline with optional audio mapping
        runFFmpegBitexactClean(tempSilentInput, tempSilentOutput, ['-c:v', 'copy']);

        assert.ok(fs.existsSync(tempSilentOutput), 'Output video must be produced without audio mapping failure');
        assert.ok(fs.statSync(tempSilentOutput).size > 0, 'Output video must not be empty');
      } finally {
        if (fs.existsSync(tempSilentInput)) fs.unlinkSync(tempSilentInput);
        if (fs.existsSync(tempSilentOutput)) fs.unlinkSync(tempSilentOutput);
      }
    },
  },

  {
    id: 'T2-F4-04',
    feature: 'F4',
    tier: 2,
    title: 'Virtual file cleanup (cleanupVirtualFiles) executes reliably in finally block even when FFmpeg throws an error',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      // Verify cleanupVirtualFiles function definition
      assert.ok(
        cleanerSrc.includes('async function cleanupVirtualFiles'),
        'cleanupVirtualFiles helper must be defined'
      );

      // Verify finally block execution in executeClean
      assert.ok(
        cleanerSrc.includes('finally {') && cleanerSrc.includes('cleanupVirtualFiles'),
        'cleanupVirtualFiles must be invoked inside finally block to ensure memory release'
      );
    },
  },

  {
    id: 'T2-F4-05',
    feature: 'F4',
    tier: 2,
    title: 'Zero rounded-full pill badges and zero nested cards exist across ForensicsTable.tsx and ModeSelector.tsx',
    async run() {
      const forensicsSrc = loadSourceFile('components/ForensicsTable.tsx');
      const modeSelectorSrc = loadSourceFile('components/ModeSelector.tsx');

      // Check ForensicsTable
      const fPills = checkZeroRoundedFullPillBadges(forensicsSrc);
      assert.ok(fPills.passed, `ForensicsTable violates badge rule: ${fPills.occurrences.join(', ')}`);
      const fCards = checkZeroNestedCards(forensicsSrc);
      assert.ok(fCards.passed, `ForensicsTable violates nested card rule: ${fCards.message}`);

      // Check ModeSelector
      const mPills = checkZeroRoundedFullPillBadges(modeSelectorSrc);
      assert.ok(mPills.passed, `ModeSelector violates badge rule: ${mPills.occurrences.join(', ')}`);
      const mCards = checkZeroNestedCards(modeSelectorSrc);
      assert.ok(mCards.passed, `ModeSelector violates nested card rule: ${mCards.message}`);
    },
  },
];
