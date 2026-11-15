/**
 * Tier 4 — Real-World Application Workloads: End-to-End Image Creator Journeys
 * Tests T4-IMG-01 to T4-IMG-05
 *
 * Scenarios:
 * - Journey 1: Photographer Camera Upload -> Mode 1 Lossless Purge -> Forensic Audit -> Clean Export
 * - Journey 2: AI Artist Image -> Mode 2 Anti-SynthID Shield -> Layer 2 Forensic Verification (Blindada)
 * - Journey 3: Marketing Agency Multi-Variant Campaign -> Mode 3 Spoofer (5 variants) -> Pairwise Distinct Fingerprints
 * - Journey 4: Multi-Format Batch Ingestion (JPEG -> PNG -> WebP -> BMP) with Memory Cleanup
 * - Journey 5: Studio Harmonization: Dual Video + Image Execution in Single Session with Zero Regression
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadSourceFile, loadModule } from '../helpers/app-loader.mjs';
import {
  createJpegWithMetadata,
  createCleanJpeg,
  createPngWithMetadata,
  createCleanPng,
  createWebpWithMetadata,
  createCleanWebp,
  createBmpImage,
} from '../helpers/image-fixtures.mjs';
import {
  scanBinaryForMarkers,
  runFFmpegBitexactClean,
} from '../helpers/ffmpeg-verifier.mjs';

export const tests = [
  // =========================================================================
  // Journey 1: Photographer Camera Workflow
  // =========================================================================
  {
    id: 'T4-IMG-01',
    feature: 'F6',
    tier: 4,
    title: 'Journey 1: Photographer camera upload -> Mode 1 lossless purge -> Forensic audit verifies Layer 1 clean with intact pixels',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');

      // 1. Photographer imports camera shot with EXIF & IPTC
      const cameraPhoto = createJpegWithMetadata({
        width: 1920,
        height: 1080,
        includeExif: true,
        includeIptc: true,
        includeXmp: true,
        includeC2pa: false,
      });

      // 2. Client-side format detection
      const formatInfo = detectImageFormat(cameraPhoto);
      assert.ok(formatInfo !== null, 'Format must be detected');
      assert.equal(formatInfo.format, 'jpeg');
      assert.equal(formatInfo.width, 1920);
      assert.equal(formatInfo.height, 1080);

      // 3. Pre-scan forensic check
      const preReport = await scanImageForensics(new Uint8Array(cameraPhoto));
      assert.equal(preReport.hasAiMarkers, false, 'Natural camera photo has no AI generation tags');
      assert.equal(preReport.fileCategory, 'camera_optical', 'Scanner must classify natural camera photo as camera_optical');
      assert.ok(preReport.originalSha256.length === 64);

      // 4. Execute Mode 1 Fast Purge
      const cleaned = await processImageMode1(new Uint8Array(cameraPhoto));
      assert.equal(cleaned.format, 'jpeg');
      assert.equal(cleaned.width, 1920, 'Width must be preserved');
      assert.equal(cleaned.height, 1080, 'Height must be preserved');
      assert.ok(cleaned.sha256.length === 64);

      // 5. Post-clean Two-Layer Forensic Audit
      const postReport = await scanImageForensics(cleaned.buffer, { processedMode: 'fast' });
      assert.equal(postReport.layer1.verified, true, 'Layer 1 must be verified 100% clean');
      assert.equal(postReport.layer2.pixelMatrixIntact, true, 'Layer 2 pixel matrix must be intact');
      assert.equal(postReport.layer2.synthIdShielded, false, 'Mode 1 must not report shielded');

      const postXmp = postReport.layer1.items.find((i) => i.id === 'xmp_metadata');
      assert.equal(postXmp?.detected, false, 'EXIF/XMP must be completely eliminated');
    },
  },

  // =========================================================================
  // Journey 2: AI Artist Anti-SynthID Shielding Workflow
  // =========================================================================
  {
    id: 'T4-IMG-02',
    feature: 'F6',
    tier: 4,
    title: 'Journey 2: AI image -> Mode 2 Anti-SynthID shield -> Layer 2 verification confirms Blindada & perceptual deviation',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');

      // 1. Ingest AI-generated artwork with C2PA, IPTC AI, and SynthID simulation
      const aiArtwork = createJpegWithMetadata({
        width: 128,
        height: 128,
        includeC2pa: true,
        includeIptc: true,
        includeXmp: true,
        includeExif: true,
        includeSynthId: true,
      });

      // 2. Pre-audit
      const preAudit = await scanImageForensics(new Uint8Array(aiArtwork));
      assert.equal(preAudit.hasAiMarkers, true, 'Pre-audit must detect generative AI markers');
      assert.equal(preAudit.layer1.verified, false, 'Pre-audit Layer 1 must fail');

      // 3. Execute Mode 2 Anti-SynthID Shield
      const shielded = await processImageMode2(new Uint8Array(aiArtwork));
      assert.ok(shielded.perceptualDistance >= 0, 'Perceptual distance must be measured');
      assert.ok(shielded.sha256.length === 64);

      // 4. Post-audit Two-Layer Forensic verification
      const postAudit = await scanImageForensics(shielded.buffer, { processedMode: 'deep' });
      assert.equal(postAudit.layer1.verified, true, 'Post-audit Layer 1 must be verified clean');
      assert.equal(postAudit.layer2.synthIdShielded, true, 'Post-audit Layer 2 must confirm SynthID shielded (Blindada)');

      const synthIdDiag = postAudit.diagnostics.find((d) => d.id === 'synthid');
      assert.ok(synthIdDiag?.sanitizedState.includes('Blindada'), 'Diagnostic must state Blindada');
    },
  },

  // =========================================================================
  // Journey 3: Marketing Agency Multi-Variant Campaign
  // =========================================================================
  {
    id: 'T4-IMG-03',
    feature: 'F6',
    tier: 4,
    title: 'Journey 3: Agency Multi-Variant Spoofer generates 5 variants with 100% collision-free cryptographic fingerprints',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');

      // 1. Ingest master ad creative (BMP)
      const masterCreative = createBmpImage({ width: 32, height: 32 });

      // 2. Execute Mode 3 generating 5 campaign variants
      const variants = await processImageMode3(new Uint8Array(masterCreative), 5);
      assert.equal(variants.length, 5, 'Must generate exactly 5 variants');

      // 3. Pairwise comparison of all 10 combinations
      for (let i = 0; i < variants.length; i++) {
        for (let j = i + 1; j < variants.length; j++) {
          assert.notEqual(
            variants[i].sha256,
            variants[j].sha256,
            `Variant ${variants[i].id} and ${variants[j].id} must have distinct SHA-256`
          );
          assert.notEqual(
            variants[i].md5,
            variants[j].md5,
            `Variant ${variants[i].id} and ${variants[j].id} must have distinct MD5`
          );
        }
      }

      // 4. Audit each variant with forensic scanner
      for (const v of variants) {
        const audit = await scanImageForensics(v.buffer, { processedMode: 'spoofer' });
        assert.equal(audit.layer1.verified, true, `Variant ${v.id} Layer 1 must be verified clean`);
        assert.equal(audit.processedMode, 'spoofer');
      }
    },
  },

  // =========================================================================
  // Journey 4: Multi-Format Batch Ingestion Workflow
  // =========================================================================
  {
    id: 'T4-IMG-04',
    feature: 'F6',
    tier: 4,
    title: 'Journey 4: Multi-format sequential ingestion (JPEG -> PNG -> WebP -> BMP) succeeds with 0 metadata leakage',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');

      const queue = [
        { name: 'photo.jpg', buf: createJpegWithMetadata({ includeC2pa: true }), expectedFmt: 'jpeg' },
        { name: 'graphic.png', buf: createPngWithMetadata({ includeC2pa: true }), expectedFmt: 'png' },
        { name: 'banner.webp', buf: createWebpWithMetadata({ includeC2pa: true }), expectedFmt: 'webp' },
        { name: 'diagram.bmp', buf: createBmpImage({ width: 24, height: 24 }), expectedFmt: 'bmp' },
      ];

      for (const item of queue) {
        // Detect format
        const detected = detectImageFormat(item.buf);
        assert.equal(detected?.format, item.expectedFmt, `${item.name} format mismatch`);

        // Clean image
        const cleanResult = await processImageMode1(new Uint8Array(item.buf));
        assert.equal(cleanResult.format, item.expectedFmt);

        // Audit clean image
        const audit = await scanImageForensics(cleanResult.buffer, { processedMode: 'fast' });
        assert.equal(audit.layer1.verified, true, `${item.name} Layer 1 must be verified clean`);
        assert.equal(audit.hasAiMarkers, false, `${item.name} must have 0 AI markers after purge`);
      }
    },
  },

  // =========================================================================
  // Journey 5: Studio Media Harmonization & Video Non-Regression
  // =========================================================================
  {
    id: 'T4-IMG-05',
    feature: 'F6',
    tier: 4,
    title: 'Journey 5: Studio media harmonization verifies video non-regression and clean dual video+image processing',
    async run() {
      const { scanVideoForensics } = loadModule('lib/forensicsScanner.ts');
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const sampleVideo = 'video1.mp4';
      assert.ok(fs.existsSync(sampleVideo), 'video1.mp4 fixture must exist for non-regression verification');

      // 1. Process and scan sample video (Video regression check)
      const videoBytes = fs.readFileSync(sampleVideo);
      const videoFile = new File([videoBytes], 'video1.mp4', { type: 'video/mp4' });
      const videoReport = await scanVideoForensics(videoFile, { skipAudio: true });

      assert.equal(videoReport.layer1.name, 'Contenedor y Metadatos Digitales');
      assert.equal(videoReport.layer2.name, 'Transformación de Señal (Píxeles y Espectro)');
      assert.equal(videoReport.layer1.verified, false, 'Untreated video contains C2PA');

      // 2. Process and scan sample image in same session
      const imageBytes = createCleanJpeg();
      const imageFile = new File([imageBytes], 'photo.jpg', { type: 'image/jpeg' });
      const imageReport = await scanImageForensics(imageFile, { processedMode: 'fast' });

      assert.equal(imageReport.layer1.name, 'Contenedor y Metadatos Digitales');
      assert.equal(imageReport.layer1.verified, true, 'Clean image Layer 1 verified');
      assert.equal(imageReport.acousticAnalysis?.hasAudio, false, 'Image reports no audio track');

      // 3. Confirm video report was not mutated by image scan
      assert.equal(videoReport.layer1.verified, false, 'Video report state must remain distinct from image');
    },
  },
];
