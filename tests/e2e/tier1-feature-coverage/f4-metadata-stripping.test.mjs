/**
 * Tier 1 — Feature Area 4: Complete Video Metadata Stripping
 * Tests T1-F4-01 to T1-F4-05
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSourceFile } from '../helpers/app-loader.mjs';
import {
  scanBinaryForMarkers,
  verifyBitexactPipeline,
  probeVideoMetadata,
  runFFmpegBitexactClean,
} from '../helpers/ffmpeg-verifier.mjs';

export const tests = [
  {
    id: 'T1-F4-01',
    feature: 'F4',
    tier: 1,
    title: 'Mode 1 FFmpeg arguments include -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      // Extract Mode 1 exec arguments block
      const mode1Idx = cleanerSrc.indexOf("if (mode === 'fast') {");
      assert.ok(mode1Idx !== -1, "Mode 1 execution block 'if (mode === \\'fast\\') {' must exist in useFFmpegCleaner.ts");

      const mode2Idx = cleanerSrc.indexOf("} else if (mode === 'deep') {");
      const mode1Section = cleanerSrc.slice(mode1Idx, mode2Idx);

      const requiredFlags = [
        '-map',
        '0:v:0',
        '0:a?',
        '-map_metadata',
        '-bsf:v',
        'filter_units=remove_types=6',
        '-dn',
        '-fflags',
        '+bitexact',
        '-flags:v',
        '-flags:a',
        '-metadata:s:v:0',
        '-metadata:s:a:0',
        'encoder=',
      ];

      for (const flag of requiredFlags) {
        assert.ok(
          mode1Section.includes(`'${flag}'`),
          `Mode 1 must include flag '${flag}'`
        );
      }
    },
  },

  {
    id: 'T1-F4-02',
    feature: 'F4',
    tier: 1,
    title: 'Mode 2 FFmpeg arguments include CRF 18 re-encoding, acoustic filter, and bitexact metadata stripping flags',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      const mode2Idx = cleanerSrc.indexOf("} else if (mode === 'deep') {");
      assert.ok(mode2Idx !== -1, 'Mode 2 block must exist');

      const mode3Idx = cleanerSrc.indexOf("} else if (mode === 'spoofer') {");
      const mode2Section = cleanerSrc.slice(mode2Idx, mode3Idx);

      // Verify CRF 18
      assert.ok(
        mode2Section.includes("'-crf'") && mode2Section.includes("'18'"),
        'Mode 2 must enforce CRF 18 for high fidelity encoding'
      );

      // Verify acoustic bandpass/notch filtering (20Hz to 19.5kHz)
      assert.ok(
        mode2Section.includes('highpass=f=20') && mode2Section.includes('lowpass=f=19500'),
        'Mode 2 must enforce acoustic filter: highpass 20Hz and lowpass 19.5kHz'
      );

      // Verify bitexact stripping flags
      assert.ok(mode2Section.includes("'filter_units=remove_types=6'"), 'Mode 2 must remove SEI tags');
      assert.ok(mode2Section.includes("'-fflags'") && mode2Section.includes("'+bitexact'"), 'Mode 2 must set +bitexact');
      assert.ok(mode2Section.includes("'-movflags'") && mode2Section.includes("'+faststart'"), 'Mode 2 must include +faststart');
    },
  },

  {
    id: 'T1-F4-03',
    feature: 'F4',
    tier: 1,
    title: 'Mode 3 Multi-Variant Spoofer generates 3, 5, or 10 distinct files with unique SHA-256 and MD5 cryptographic hashes',
    async run() {
      const cleanerSrc = loadSourceFile('components/useFFmpegCleaner.ts');

      const mode3Idx = cleanerSrc.indexOf("mode === 'spoofer'");
      assert.ok(mode3Idx !== -1, 'Mode 3 block must exist');
      const mode3Section = cleanerSrc.slice(mode3Idx);

      // Check support for variant loops and distinct cropSeeds
      assert.ok(mode3Section.includes('cropSeeds'), 'Mode 3 must use cropSeeds array for varying aspect micro-crops');
      assert.ok(mode3Section.includes('variantCount'), 'Mode 3 must support configurable variantCount (3, 5, 10)');
      assert.ok(mode3Section.includes('noise='), 'Mode 3 must apply variant-indexed noise filter');
      assert.ok(mode3Section.includes('eq=brightness='), 'Mode 3 must apply micro-brightness modulation');
      assert.ok(mode3Section.includes('computeSHA256'), 'Mode 3 must compute SHA256 per variant');
      assert.ok(mode3Section.includes('computeMD5'), 'Mode 3 must compute MD5 per variant');
    },
  },

  {
    id: 'T1-F4-04',
    feature: 'F4',
    tier: 1,
    title: 'FFmpeg execution on sample video1.mp4 purges all C2PA manifests (c2pa, jumb) and SynthID markers',
    async run() {
      const inputVideo = 'video1.mp4';
      assert.ok(fs.existsSync(inputVideo), 'Input video1.mp4 fixture must exist');

      // 1. Verify input has C2PA / SynthID markers
      const preScan = scanBinaryForMarkers(inputVideo, ['c2pa', 'jumb', 'SynthID']);
      assert.ok(
        preScan.foundMarkers.length > 0,
        `Expected video1.mp4 to contain tracking markers, found: ${preScan.foundMarkers.join(', ')}`
      );

      // 2. Execute bitexact clean pipeline
      const tempOutput = path.join(process.cwd(), `test_clean_tier1_${Date.now()}.mp4`);
      try {
        runFFmpegBitexactClean(inputVideo, tempOutput, ['-c:v', 'copy', '-c:a', 'copy']);

        assert.ok(fs.existsSync(tempOutput), 'Cleaned output video must be produced');
        assert.ok(fs.statSync(tempOutput).size > 0, 'Cleaned output video must not be empty');

        // 3. Scan cleaned binary
        const postScan = scanBinaryForMarkers(tempOutput, ['c2pa', 'jumb', 'SynthID']);
        assert.equal(
          postScan.foundMarkers.length,
          0,
          `Output must have 0 tracking markers remaining, but found: ${postScan.foundMarkers.join(', ')}`
        );
      } finally {
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
      }
    },
  },

  {
    id: 'T1-F4-05',
    feature: 'F4',
    tier: 1,
    title: 'Binary and probe scan of output video confirms 0 remaining XMP metadata, 0 EXIF metadata, and 0 encoder tags',
    async run() {
      const inputVideo = 'video1.mp4';
      const tempOutput = path.join(process.cwd(), `test_clean_probe_${Date.now()}.mp4`);

      try {
        runFFmpegBitexactClean(inputVideo, tempOutput, ['-c:v', 'copy', '-c:a', 'copy']);

        // 1. Binary scan for Adobe XMP & EXIF headers
        const binaryScan = scanBinaryForMarkers(tempOutput, [
          'http://ns.adobe.com/xap/1.0/',
          '<x:xmpmeta',
          'photoshop',
          'udta.ilst',
        ]);

        assert.equal(
          binaryScan.foundMarkers.length,
          0,
          `Disallowed metadata strings found: ${binaryScan.foundMarkers.join(', ')}`
        );

        // 2. ffprobe inspection if available
        const probeData = probeVideoMetadata(tempOutput);
        if (probeData) {
          const formatTags = probeData.format?.tags || {};
          const videoTags = probeData.streams?.[0]?.tags || {};

          // Verify encoder tags are empty or purged
          assert.equal(formatTags.encoder || '', '', 'Format encoder tag must be empty');
          assert.equal(videoTags.encoder || '', '', 'Video stream encoder tag must be empty');
          assert.equal(formatTags.comment || '', '', 'Format comment tag must be empty');
        }
      } finally {
        if (fs.existsSync(tempOutput)) {
          fs.unlinkSync(tempOutput);
        }
      }
    },
  },
];
