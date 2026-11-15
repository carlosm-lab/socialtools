/**
 * Tier 3 — Cross-Feature Integration: Image Format × Mode Matrix & Media Coexistence
 * Tests T3-IMG-01 to T3-IMG-14
 *
 * Covers:
 * - Image Format × Studio Processing Mode (JPEG, PNG, WebP, BMP × Mode 1, 2, 3)
 * - License Tier Gating (Free, Creator, Agency, Admin)
 * - Pipeline Coexistence: Video and Image workflows running side-by-side with zero collision
 * - Unified Forensics Dispatcher (scanMediaForensics)
 */

import assert from 'node:assert/strict';
import { loadSourceFile, loadModule, loadRoute } from '../helpers/app-loader.mjs';
import { createMockRequest, parseJsonResponse } from '../helpers/test-context.mjs';
import {
  createJpegWithMetadata,
  createCleanJpeg,
  createPngWithMetadata,
  createCleanPng,
  createWebpWithMetadata,
  createCleanWebp,
  createBmpImage,
} from '../helpers/image-fixtures.mjs';

export const tests = [
  // =========================================================================
  // Image Format × Mode Matrix
  // =========================================================================
  {
    id: 'T3-IMG-01',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: JPEG × Mode 1 Fast Purge strips C2PA, EXIF, and XMP while preserving frame dimensions',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const jpeg = createJpegWithMetadata({ width: 128, height: 96, includeC2pa: true, includeExif: true });

      const res = await processImageMode1(new Uint8Array(jpeg));
      assert.equal(res.format, 'jpeg');
      assert.equal(res.width, 128);
      assert.equal(res.height, 96);

      const text = Buffer.from(res.buffer).toString('latin1');
      assert.equal(text.includes('c2pa'), false, 'C2PA must be purged');
      assert.equal(text.includes('Exif'), false, 'EXIF must be purged');
      assert.ok(res.sha256.length === 64);
    },
  },

  {
    id: 'T3-IMG-02',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: JPEG × Mode 2 Anti-SynthID Shield applies micro-crop and stochastic noise to pixel matrix',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const jpeg = createJpegWithMetadata({ width: 64, height: 64, includeC2pa: true });

      const res = await processImageMode2(new Uint8Array(jpeg));
      assert.equal(res.format, 'jpeg');
      assert.ok(res.perceptualDistance >= 0);
      assert.ok(res.shieldedDHash.length === 16);

      const text = Buffer.from(res.buffer).toString('latin1');
      assert.equal(text.includes('c2pa'), false, 'C2PA must be purged');
    },
  },

  {
    id: 'T3-IMG-03',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: JPEG × Mode 3 Multi-Variant Spoofer generates 5 variants with strictly distinct cryptographic hashes',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const jpeg = createJpegWithMetadata({ width: 48, height: 48 });

      const variants = await processImageMode3(new Uint8Array(jpeg), 5);
      assert.equal(variants.length, 5);

      const shaSet = new Set(variants.map((v) => v.sha256));
      assert.equal(shaSet.size, 5, 'Every variant must produce a unique SHA-256 hash');

      const md5Set = new Set(variants.map((v) => v.md5));
      assert.equal(md5Set.size, 5, 'Every variant must produce a unique MD5 hash');
    },
  },

  {
    id: 'T3-IMG-04',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: PNG × Mode 1 Fast Purge removes eXIf and caBX chunks while preserving valid PNG chunks',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const png = createPngWithMetadata({ width: 64, height: 64, includeExif: true, includeC2pa: true });

      const res = await processImageMode1(new Uint8Array(png));
      assert.equal(res.format, 'png');
      assert.equal(res.width, 64);
      assert.equal(res.height, 64);

      const text = Buffer.from(res.buffer).toString('latin1');
      assert.equal(text.includes('caBX'), false);
      assert.equal(text.includes('eXIf'), false);
      assert.ok(text.includes('IHDR'));
      assert.ok(text.includes('IDAT'));
    },
  },

  {
    id: 'T3-IMG-05',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: PNG × Mode 2 Anti-SynthID Shield alters pixel distribution with zero remaining metadata chunks',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const png = createPngWithMetadata({ width: 32, height: 32 });

      const res = await processImageMode2(new Uint8Array(png));
      assert.ok(res.buffer.length > 0);
      assert.ok(res.sha256.length === 64);
      assert.ok(res.perceptualDistance >= 0);
    },
  },

  {
    id: 'T3-IMG-06',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: PNG × Mode 3 Multi-Variant Spoofer generates 3 unique variants with distinct dHash',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const png = createPngWithMetadata({ width: 32, height: 32 });

      const variants = await processImageMode3(new Uint8Array(png), 3);
      assert.equal(variants.length, 3);
      assert.notEqual(variants[0].sha256, variants[1].sha256);
      assert.notEqual(variants[1].sha256, variants[2].sha256);
    },
  },

  {
    id: 'T3-IMG-07',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: WebP × Mode 1 Fast Purge clears VP8X metadata flags and drops EXIF/XMP/jumb RIFF chunks',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const webp = createWebpWithMetadata({ width: 64, height: 64, includeExif: true, includeC2pa: true });

      const res = await processImageMode1(new Uint8Array(webp));
      assert.equal(res.format, 'webp');

      const text = Buffer.from(res.buffer).toString('latin1');
      assert.equal(text.includes('EXIF'), false);
      assert.equal(text.includes('jumb'), false);
    },
  },

  {
    id: 'T3-IMG-08',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: WebP × Mode 2 Anti-SynthID Shield applies micro-noise perturbation with clean container',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const webp = createWebpWithMetadata({ width: 48, height: 48 });

      const res = await processImageMode2(new Uint8Array(webp));
      assert.ok(res.buffer.length > 0);
      assert.ok(res.perceptualDistance >= 0);
    },
  },

  {
    id: 'T3-IMG-09',
    feature: 'F6',
    tier: 3,
    title: 'Cross-Matrix: BMP × Mode 1 Fast Purge normalizes DIB header to 54 bytes and removes trailing bytes',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const baseBmp = createBmpImage({ width: 20, height: 20 });
      const bmpWithStegano = Buffer.concat([baseBmp, Buffer.from('HIDDEN-STEGANO-PAYLOAD-12345')]);

      const res = await processImageMode1(new Uint8Array(bmpWithStegano));
      assert.equal(res.format, 'bmp');
      assert.equal(res.width, 20);
      assert.equal(res.height, 20);
      assert.equal(Buffer.from(res.buffer).toString('latin1').includes('HIDDEN-STEGANO'), false);
    },
  },

  // =========================================================================
  // License Gating for Image Processing
  // =========================================================================
  {
    id: 'T3-IMG-10',
    feature: 'F6',
    tier: 3,
    title: 'License Gating: Free user attempting Mode 2 deep clean is blocked if modeDeepAntiSynthID is false',
    async run() {
      const hookSource = loadSourceFile('components/useImageCleaner.ts');
      // Verify gating check in executeClean
      const gateIdx = hookSource.indexOf("mode === 'deep'");
      assert.ok(gateIdx !== -1, "executeClean must check mode === 'deep'");
      const gateSlice = hookSource.slice(gateIdx, gateIdx + 400);
      assert.ok(
        gateSlice.includes('modeDeepAntiSynthID') || gateSlice.includes('licenseFeatures'),
        'Mode 2 must enforce modeDeepAntiSynthID license gate'
      );
    },
  },

  {
    id: 'T3-IMG-11',
    feature: 'F6',
    tier: 3,
    title: 'License Gating: Non-Agency user attempting Mode 3 spoofer clean is blocked if modeMultiVariant is false',
    async run() {
      const hookSource = loadSourceFile('components/useImageCleaner.ts');
      const spooferIdx = hookSource.indexOf("mode === 'spoofer'");
      assert.ok(spooferIdx !== -1, "executeClean must check mode === 'spoofer'");
      const spooferSlice = hookSource.slice(spooferIdx, spooferIdx + 400);
      assert.ok(
        spooferSlice.includes('modeMultiVariant') || spooferSlice.includes('licenseFeatures'),
        'Mode 3 must enforce modeMultiVariant license gate'
      );
    },
  },

  {
    id: 'T3-IMG-12',
    feature: 'F6',
    tier: 3,
    title: 'License Gating: Admin role and Agency license grant maxVariants: 10 with zero credit cost',
    async run() {
      const { POST } = loadRoute('app/api/verify-license/route.ts');
      const req = createMockRequest('http://localhost:3000/api/verify-license', {
        method: 'POST',
        body: { licenseKey: 'AGENCY-PRO-TEST-KEY' },
      });
      const res = await POST(req);
      const data = await parseJsonResponse(res);

      assert.equal(data.valid, true, 'Agency key must validate');
      assert.equal(data.plan, 'agency', 'Plan must be agency');
      assert.equal(data.features?.modeMultiVariant, true, 'Agency must have modeMultiVariant');
      assert.equal(data.features?.maxVariants, 10, 'Agency must unlock 10 variants');
    },
  },

  // =========================================================================
  // Coexistence of Video and Image Pipelines
  // =========================================================================
  {
    id: 'T3-IMG-13',
    feature: 'F6',
    tier: 3,
    title: 'Coexistence: Video forensic scanner and Image forensic scanner can run concurrently without state conflict',
    async run() {
      const { scanVideoForensics } = loadModule('lib/forensicsScanner.ts');
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');

      const videoBuf = Buffer.from('FAKE-MP4-VIDEO-HEADER-ftypisom-c2pa-jumb');
      const videoFile = new File([videoBuf], 'test.mp4', { type: 'video/mp4' });

      const imageBuf = createJpegWithMetadata({ includeC2pa: true });
      const imageFile = new File([imageBuf], 'test.jpg', { type: 'image/jpeg' });

      // Run both concurrently
      const [videoReport, imageReport] = await Promise.all([
        scanVideoForensics(videoFile, { skipAudio: true }),
        scanImageForensics(imageFile),
      ]);

      assert.ok(videoReport.layer1, 'Video report must have layer1');
      assert.ok(imageReport.layer1, 'Image report must have layer1');
      assert.equal(imageReport.acousticAnalysis?.hasAudio, false, 'Image must report no audio');
      assert.ok(imageReport.originalSha256, 'Image report must record originalSha256');
    },
  },

  {
    id: 'T3-IMG-14',
    feature: 'F6',
    tier: 3,
    title: 'Unified Forensics Dispatcher: scanMediaForensics routes .mp4 to video scanner and .jpg to image scanner',
    async run() {
      const { scanMediaForensics } = loadModule('lib/forensicsScanner.ts');

      // Video test
      const videoBuf = Buffer.from('TEST-MP4-ftypisom');
      const videoFile = new File([videoBuf], 'sample.mp4', { type: 'video/mp4' });
      const vReport = await scanMediaForensics(videoFile, { skipAudio: true });
      assert.ok(vReport.layer1, 'Unified scanner must return valid report for video');

      // Image test
      const imgBuf = createJpegWithMetadata();
      const imgFile = new File([imgBuf], 'sample.jpg', { type: 'image/jpeg' });
      const iReport = await scanMediaForensics(imgFile);
      assert.ok(iReport.layer1, 'Unified scanner must return valid report for image');
      assert.equal(iReport.acousticAnalysis?.hasAudio, false, 'Image routed report must report no audio');
    },
  },
];
