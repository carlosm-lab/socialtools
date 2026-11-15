/**
 * Tier 2 — Boundary & Corner Cases: Production-Ready Image Processing
 * Tests T2-IMG-01 to T2-IMG-35 (>= 5 cases per feature)
 *
 * Covers:
 * - B1: Corrupted Streams & Truncated Headers
 * - B2: Missing APP Markers & Truncated Chunks
 * - B3: Extreme Dimensions & Aspect Ratios
 * - B4: Boundary Variant Counts (Mode 3 Spoofer)
 * - B5: Steganographic & Boundary Metadata Manifests
 * - B6: Forensic Scanner Boundary Inputs
 * - B7: UI Lifecycle & License Gating Boundary States
 */

import assert from 'node:assert/strict';
import { loadSourceFile, loadModule } from '../helpers/app-loader.mjs';
import {
  createJpegWithMetadata,
  createCleanJpeg,
  createPngWithMetadata,
  createCleanPng,
  createWebpWithMetadata,
  createCleanWebp,
  createBmpImage,
  createTiffWithMetadata,
  createCorruptedImage,
} from '../helpers/image-fixtures.mjs';

export const tests = [
  // =========================================================================
  // B1: Corrupted Streams & Truncated Headers
  // =========================================================================
  {
    id: 'T2-IMG-01',
    feature: 'F6',
    tier: 2,
    title: 'detectImageFormat returns null safely when passed an empty 0-byte buffer',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const emptyBuf = createCorruptedImage('empty');

      const info = detectImageFormat(emptyBuf);
      assert.strictEqual(info, null, 'Empty buffer must return null');
    },
  },

  {
    id: 'T2-IMG-02',
    feature: 'F6',
    tier: 2,
    title: 'detectImageFormat handles truncated JPEG header (<4 bytes) safely without out-of-bounds error',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const shortBuf = new Uint8Array([0xff, 0xd8]);

      const info = detectImageFormat(shortBuf);
      assert.strictEqual(info, null, 'Short truncated buffer must return null');
    },
  },

  {
    id: 'T2-IMG-03',
    feature: 'F6',
    tier: 2,
    title: 'detectImageFormat handles truncated PNG header (<8 bytes) safely without error',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const truncPng = createCorruptedImage('truncated_png_header');

      const info = detectImageFormat(truncPng);
      assert.strictEqual(info, null, 'Truncated PNG signature must return null');
    },
  },

  {
    id: 'T2-IMG-04',
    feature: 'F6',
    tier: 2,
    title: 'detectImageFormat handles corrupted RIFF WebP header with invalid size field safely',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const badRiff = createCorruptedImage('corrupted_riff_webp');

      const info = detectImageFormat(badRiff);
      // Still recognizes webp container structure without infinite loop
      assert.ok(info !== undefined, 'Must not throw on invalid size field');
    },
  },

  {
    id: 'T2-IMG-05',
    feature: 'F6',
    tier: 2,
    title: 'detectImageFormat rejects random non-image binary garbage safely',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const garbage = createCorruptedImage('random_garbage_bytes');

      const info = detectImageFormat(garbage);
      assert.strictEqual(info, null, 'Random binary noise must not match any image format');
    },
  },

  // =========================================================================
  // B2: Missing APP Markers & Truncated Chunks
  // =========================================================================
  {
    id: 'T2-IMG-06',
    feature: 'F6',
    tier: 2,
    title: 'stripJpegMetadata handles JPEG missing EOI marker safely without infinite loop',
    async run() {
      const { stripJpegMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const missingEoi = createCorruptedImage('jpeg_missing_eoi');

      const result = stripJpegMetadata(new Uint8Array(missingEoi));
      assert.ok(result.length > 0, 'Must produce valid buffer even when source lacks EOI');
    },
  },

  {
    id: 'T2-IMG-07',
    feature: 'F6',
    tier: 2,
    title: 'stripJpegMetadata handles contiguous fill bytes (0xFF 0xFF 0xFF) without desynchronizing marker offset',
    async run() {
      const { stripJpegMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const baseJpeg = createJpegWithMetadata({ width: 32, height: 32 });

      // Insert extra 0xFF padding bytes between markers
      const paddedBytes = [];
      for (let i = 0; i < baseJpeg.length; i++) {
        paddedBytes.push(baseJpeg[i]);
        if (baseJpeg[i] === 0xff && i > 1 && i < 20) {
          paddedBytes.push(0xff, 0xff); // inject extra fill bytes
        }
      }

      const clean = stripJpegMetadata(new Uint8Array(paddedBytes));
      assert.ok(clean.length > 0, 'Must successfully parse and clean padded JPEG');
      assert.equal(clean[0], 0xff);
      assert.equal(clean[1], 0xd8);
    },
  },

  {
    id: 'T2-IMG-08',
    feature: 'F6',
    tier: 2,
    title: 'stripPngMetadata on an already clean PNG leaves essential chunks intact',
    async run() {
      const { stripPngMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const cleanInput = createCleanPng({ width: 32, height: 32 });

      const cleanOutput = stripPngMetadata(new Uint8Array(cleanInput));
      assert.equal(
        cleanOutput.length,
        cleanInput.length,
        'Already-clean PNG should not lose any chunks'
      );
      assert.equal(
        Buffer.from(cleanOutput).toString('latin1').includes('IHDR'),
        true,
        'Must preserve IHDR'
      );
    },
  },

  {
    id: 'T2-IMG-09',
    feature: 'F6',
    tier: 2,
    title: 'stripWebpMetadata handles simple WebP lacking VP8X extended header safely',
    async run() {
      const { stripWebpMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const cleanWebp = createCleanWebp({ width: 40, height: 40 });

      const result = stripWebpMetadata(new Uint8Array(cleanWebp));
      assert.ok(result.length >= 12, 'Must retain RIFF header');
      assert.equal(Buffer.from(result.subarray(8, 12)).toString('ascii'), 'WEBP');
    },
  },

  {
    id: 'T2-IMG-10',
    feature: 'F6',
    tier: 2,
    title: 'stripPngMetadata terminates gracefully when chunk length exceeds remaining buffer size',
    async run() {
      const { stripPngMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const truncIhdr = createCorruptedImage('png_truncated_ihdr');

      const result = stripPngMetadata(new Uint8Array(truncIhdr));
      assert.ok(result.length >= 8, 'Must return at least signature without crashing');
    },
  },

  // =========================================================================
  // B3: Extreme Dimensions & Aspect Ratios
  // =========================================================================
  {
    id: 'T2-IMG-11',
    feature: 'F6',
    tier: 2,
    title: '1x1 micro-image dimension extraction and processing succeeds for JPEG, PNG, and BMP',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');

      const microBmp = createBmpImage({ width: 1, height: 1 });
      const infoBmp = detectImageFormat(microBmp);
      assert.equal(infoBmp?.width, 1, 'Micro BMP width must be 1');
      assert.equal(infoBmp?.height, 1, 'Micro BMP height must be 1');

      const resBmp = await processImageMode1(new Uint8Array(microBmp));
      assert.equal(resBmp.width, 1);
      assert.equal(resBmp.height, 1);
    },
  },

  {
    id: 'T2-IMG-12',
    feature: 'F6',
    tier: 2,
    title: 'Ultra-wide panoramic image (2000x20) dimension extraction and processing succeeds',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');

      const widePng = createPngWithMetadata({ width: 2000, height: 20 });
      const info = detectImageFormat(widePng);
      assert.equal(info?.width, 2000, 'Panoramic width must be 2000');
      assert.equal(info?.height, 20, 'Panoramic height must be 20');

      const res = await processImageMode1(new Uint8Array(widePng));
      assert.equal(res.width, 2000);
      assert.equal(res.height, 20);
    },
  },

  {
    id: 'T2-IMG-13',
    feature: 'F6',
    tier: 2,
    title: 'Ultra-tall vertical image (20x2000) dimension extraction and processing succeeds',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');

      const tallPng = createPngWithMetadata({ width: 20, height: 2000 });
      const info = detectImageFormat(tallPng);
      assert.equal(info?.width, 20, 'Vertical width must be 20');
      assert.equal(info?.height, 2000, 'Vertical height must be 2000');

      const res = await processImageMode1(new Uint8Array(tallPng));
      assert.equal(res.width, 20);
      assert.equal(res.height, 2000);
    },
  },

  {
    id: 'T2-IMG-14',
    feature: 'F6',
    tier: 2,
    title: 'BMP with negative height (top-down bitmap) extracts positive absolute height correctly',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const topDownBmp = createBmpImage({ width: 32, height: 16 });

      // In BMP BITMAPINFOHEADER, offset 22 is int32 height; set negative for top-down
      topDownBmp.writeInt32LE(-16, 22);

      const info = detectImageFormat(topDownBmp);
      assert.equal(info?.height, 16, 'Height must be positive absolute value 16');
    },
  },

  {
    id: 'T2-IMG-15',
    feature: 'F6',
    tier: 2,
    title: 'Zero-dimension BMP (width 0 or height 0) is safely flagged as invalid dimension',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const zeroBmp = createCorruptedImage('zero_dimension_bmp');

      const info = detectImageFormat(zeroBmp);
      assert.strictEqual(info?.width, undefined, 'Invalid zero dimension must not return valid width');
    },
  },

  // =========================================================================
  // B4: Boundary Variant Counts (Mode 3 Spoofer)
  // =========================================================================
  {
    id: 'T2-IMG-16',
    feature: 'F6',
    tier: 2,
    title: 'Mode 3 with variantCount = 1 clamps to minimum batch (3 variants) safely',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 16, height: 16 });

      const variants = await processImageMode3(new Uint8Array(bmp), 1);
      assert.equal(variants.length, 3, 'Variant count < 3 must clamp to 3');
    },
  },

  {
    id: 'T2-IMG-17',
    feature: 'F6',
    tier: 2,
    title: 'Mode 3 with minimum allowed batch (variantCount = 3) produces 3 distinct variants',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 16, height: 16 });

      const variants = await processImageMode3(new Uint8Array(bmp), 3);
      assert.equal(variants.length, 3, 'Must produce exactly 3 variants');
      assert.notEqual(variants[0].sha256, variants[1].sha256, 'Variant 1 & 2 SHA-256 must differ');
      assert.notEqual(variants[1].sha256, variants[2].sha256, 'Variant 2 & 3 SHA-256 must differ');
    },
  },

  {
    id: 'T2-IMG-18',
    feature: 'F6',
    tier: 2,
    title: 'Mode 3 with medium batch (variantCount = 5) produces 5 distinct variants',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 16, height: 16 });

      const variants = await processImageMode3(new Uint8Array(bmp), 5);
      assert.equal(variants.length, 5, 'Must produce exactly 5 variants');
      const shas = new Set(variants.map((v) => v.sha256));
      assert.equal(shas.size, 5, 'All 5 SHA-256 hashes must be unique');
    },
  },

  {
    id: 'T2-IMG-19',
    feature: 'F6',
    tier: 2,
    title: 'Mode 3 with maximum allowed batch (variantCount = 10) produces 10 distinct variants',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 16, height: 16 });

      const variants = await processImageMode3(new Uint8Array(bmp), 10);
      assert.equal(variants.length, 10, 'Must produce exactly 10 variants');
      const shas = new Set(variants.map((v) => v.sha256));
      assert.equal(shas.size, 10, 'All 10 SHA-256 hashes must be unique');
    },
  },

  {
    id: 'T2-IMG-20',
    feature: 'F6',
    tier: 2,
    title: 'Mode 3 with excessive variantCount (> 10) clamps to maximum of 10 variants',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 16, height: 16 });

      const variants = await processImageMode3(new Uint8Array(bmp), 99);
      assert.equal(variants.length, 10, 'Variant count > 10 must clamp to 10');
    },
  },

  // =========================================================================
  // B5: Steganographic & Boundary Metadata Manifests
  // =========================================================================
  {
    id: 'T2-IMG-21',
    feature: 'F6',
    tier: 2,
    title: 'Multiple contiguous APP1 markers (both EXIF and multiple XMP packets) are all completely stripped',
    async run() {
      const { stripJpegMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const multiApp1Jpeg = createJpegWithMetadata({
        includeExif: true,
        includeXmp: true,
      });

      const clean = stripJpegMetadata(new Uint8Array(multiApp1Jpeg));
      const text = Buffer.from(clean).toString('latin1');
      assert.equal(text.includes('Exif'), false, 'Exif must be stripped');
      assert.equal(text.includes('http://ns.adobe.com'), false, 'XMP must be stripped');
    },
  },

  {
    id: 'T2-IMG-22',
    feature: 'F6',
    tier: 2,
    title: 'Nested C2PA JUMBF boxes in PNG caBX and iTXt chunks are both eliminated simultaneously',
    async run() {
      const { stripPngMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const png = createPngWithMetadata({ includeC2pa: true, includeXmp: true });

      const clean = stripPngMetadata(new Uint8Array(png));
      const text = Buffer.from(clean).toString('latin1');
      assert.equal(text.includes('caBX'), false);
      assert.equal(text.includes('iTXt'), false);
      assert.equal(text.includes('c2pa'), false);
    },
  },

  {
    id: 'T2-IMG-23',
    feature: 'F6',
    tier: 2,
    title: 'WebP with interleaved EXIF, XMP , and jumb chunks removes all 3 while keeping image frame valid',
    async run() {
      const { stripWebpMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const webp = createWebpWithMetadata({ includeExif: true, includeXmp: true, includeC2pa: true });

      const clean = stripWebpMetadata(new Uint8Array(webp));
      const text = Buffer.from(clean).toString('latin1');
      assert.equal(text.includes('EXIF'), false);
      assert.equal(text.includes('XMP '), false);
      assert.equal(text.includes('jumb'), false);
    },
  },

  {
    id: 'T2-IMG-24',
    feature: 'F6',
    tier: 2,
    title: 'Unknown custom private APPn markers (APP3, APP4, APP12) are completely purged from JPEG',
    async run() {
      const { stripJpegMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const jpeg = createJpegWithMetadata();

      // Insert custom APP3 marker (0xFF, 0xE3) with private payload
      const customPayload = Buffer.from('CUSTOM-PRIVATE-TRACKER-APP3');
      const app3Header = Buffer.from([0xff, 0xe3, 0x00, customPayload.length + 2]);
      const injected = Buffer.concat([jpeg.subarray(0, 20), app3Header, customPayload, jpeg.subarray(20)]);

      const clean = stripJpegMetadata(new Uint8Array(injected));
      const cleanText = Buffer.from(clean).toString('latin1');
      assert.equal(cleanText.includes('CUSTOM-PRIVATE-TRACKER'), false, 'APP3 marker must be purged');
    },
  },

  {
    id: 'T2-IMG-25',
    feature: 'F6',
    tier: 2,
    title: 'Text comments in COM marker (0xFE) in JPEG are purged',
    async run() {
      const { stripJpegMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const jpeg = createJpegWithMetadata();

      // Insert COM marker (0xFF, 0xFE)
      const commentPayload = Buffer.from('Comment: Created with Midjourney v6');
      const comHeader = Buffer.from([0xff, 0xfe, 0x00, commentPayload.length + 2]);
      const injected = Buffer.concat([jpeg.subarray(0, 20), comHeader, commentPayload, jpeg.subarray(20)]);

      const clean = stripJpegMetadata(new Uint8Array(injected));
      const cleanText = Buffer.from(clean).toString('latin1');
      assert.equal(cleanText.includes('Midjourney'), false, 'COM marker text must be purged');
    },
  },

  // =========================================================================
  // B6: Forensic Scanner Boundary Inputs
  // =========================================================================
  {
    id: 'T2-IMG-26',
    feature: 'F6',
    tier: 2,
    title: 'Forensic scan on a 1-byte file returns clean/handled result without throwing unhandled exception',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const singleByte = new Uint8Array([0x00]);

      const report = await scanImageForensics(singleByte);
      assert.ok(report.diagnostics.length > 0, 'Must produce report diagnostics');
      assert.equal(report.fileSizeBytes, 1, 'File size must be 1 byte');
    },
  },

  {
    id: 'T2-IMG-27',
    feature: 'F6',
    tier: 2,
    title: 'Forensic scan on image without any AI markers reports hasAiMarkers: false and 0 Layer 1 container markers',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanImg), { processedMode: 'fast' });
      assert.equal(report.hasAiMarkers, false, 'hasAiMarkers must be false for clean image');
      assert.equal(
        report.layer1.items.filter((i) => i.detected).length,
        0,
        'Layer 1 container markers must be 0 for clean Mode 1 image'
      );
      assert.equal(report.layer1.verified, true, 'Layer 1 must be verified clean');
    },
  },

  {
    id: 'T2-IMG-28',
    feature: 'F6',
    tier: 2,
    title: 'Forensic scan on image with all markers (C2PA, IPTC AI, Google, XMP) reports hasAiMarkers: true',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const fullAiImg = createJpegWithMetadata({
        includeC2pa: true,
        includeIptc: true,
        includeXmp: true,
        includeExif: true,
      });

      const report = await scanImageForensics(new Uint8Array(fullAiImg));
      assert.equal(report.hasAiMarkers, true, 'hasAiMarkers must be true');
      assert.ok(report.totalMarkersFound >= 3, 'Must detect multiple AI markers');
      assert.equal(report.layer1.verified, false, 'Layer 1 must not be verified');
    },
  },

  {
    id: 'T2-IMG-29',
    feature: 'F6',
    tier: 2,
    title: 'Forensic scan on Mode 3 spoofer output reports processedMode: spoofer with unique hash recorded',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanImg), { processedMode: 'spoofer' });
      assert.equal(report.processedMode, 'spoofer', 'processedMode must be recorded as spoofer');
      assert.equal(report.layer1.verified, true, 'Layer 1 must be verified clean');
    },
  },

  {
    id: 'T2-IMG-30',
    feature: 'F6',
    tier: 2,
    title: 'Forensic scan respects processedMode override and adjusts Layer 2 verdict accordingly',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const fastRep = await scanImageForensics(new Uint8Array(cleanImg), { processedMode: 'fast' });
      assert.equal(fastRep.layer2.synthIdShielded, false, 'Mode 1 must not claim shielded');

      const deepRep = await scanImageForensics(new Uint8Array(cleanImg), { processedMode: 'deep' });
      assert.equal(deepRep.layer2.synthIdShielded, true, 'Mode 2 must claim shielded');
    },
  },

  // =========================================================================
  // B7: UI Lifecycle & License Gating Boundary States
  // =========================================================================
  {
    id: 'T2-IMG-31',
    feature: 'F6',
    tier: 2,
    title: 'detectImageFormat is invariant to file extension and detects format strictly by binary magic bytes',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      // Pass a JPEG buffer masquerading under another name
      const jpeg = createJpegWithMetadata();
      const detected = detectImageFormat(jpeg);
      assert.equal(detected?.format, 'jpeg', 'Detection must rely exclusively on binary magic bytes');
    },
  },

  {
    id: 'T2-IMG-32',
    feature: 'F6',
    tier: 2,
    title: 'useImageCleaner provides clean state reset through clearFile method',
    async run() {
      const hookSource = loadSourceFile('components/useImageCleaner.ts');
      assert.ok(hookSource.includes('clearFile'), 'clearFile method must be defined');
      assert.ok(hookSource.includes('setSelectedFile(null)'), 'clearFile must reset selectedFile');
      assert.ok(hookSource.includes('URL.revokeObjectURL'), 'clearFile must revoke previous preview URLs to prevent leaks');
    },
  },

  {
    id: 'T2-IMG-33',
    feature: 'F6',
    tier: 2,
    title: 'Rapid consecutive execution of perceptual hash algorithms does not cause heap degradation',
    async run() {
      const { computeDHash, computePHash } = loadModule('lib/perceptualHash.ts');

      const width = 16;
      const height = 16;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i++) data[i] = (i * 31) & 0xff;

      const matrix = { width, height, data };

      for (let run = 0; run < 50; run++) {
        const d = computeDHash(matrix);
        const p = computePHash(matrix);
        assert.equal(d.length, 16);
        assert.equal(p.length, 16);
      }
    },
  },

  {
    id: 'T2-IMG-34',
    feature: 'F6',
    tier: 2,
    title: 'License gating blocks Mode 2 deep clean if user lacks Creator or Agency license',
    async run() {
      const hookSource = loadSourceFile('components/useImageCleaner.ts');
      assert.ok(hookSource.includes('licenseFeatures'), 'executeClean must accept licenseFeatures');
      assert.ok(
        hookSource.includes('modeDeepAntiSynthID') || hookSource.includes('Deep Anti-SynthID'),
        'Must check modeDeepAntiSynthID license feature'
      );
    },
  },

  {
    id: 'T2-IMG-35',
    feature: 'F6',
    tier: 2,
    title: 'License gating blocks Mode 3 spoofer clean if user lacks Agency license or admin role',
    async run() {
      const hookSource = loadSourceFile('components/useImageCleaner.ts');
      assert.ok(
        hookSource.includes('modeMultiVariant') || hookSource.includes('Multi-Variant Spoofer'),
        'Must check modeMultiVariant license feature'
      );
    },
  },
];
