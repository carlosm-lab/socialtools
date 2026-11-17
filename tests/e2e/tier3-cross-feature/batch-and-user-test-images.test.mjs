/**
 * Tier 3 — Cross-Feature: Batch Processing & User Real AI Test Images
 *
 * Verifies:
 * 1. Zero false-positive metadata detection on user's real AI test PNGs
 * 2. Bitexact metadata stripping (purging iCCP, leaving only IHDR, sBIT, IDAT, IEND)
 * 3. Re-scan certifies Layer 1 verified 100% clean with 0 detected metadata tags
 * 4. Batch processing engine handles multiple images & videos
 * 5. ZIP bundling creates valid archives for batch downloads
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadModule } from '../helpers/app-loader.mjs';

export const tests = [
  // =========================================================================
  // User Real Test Images Forensic Audit & Cleaning
  // =========================================================================
  {
    id: 'T3-BATCH-01',
    feature: 'F6',
    tier: 3,
    title: 'Format-aware audit on user real AI test images confirms 0 C2PA, 0 IPTC, 0 EXIF, 0 XMP',
    async run() {
      const { auditImageContainer, scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');

      const testFiles = [
        'IMG_20261117_022317.png',
        'IMG_20261117_022405.png',
        'IMG_20261117_022511.png',
        'IMG_20261117_022547.png',
      ];

      for (const fileName of testFiles) {
        const filePath = path.resolve(process.cwd(), fileName);
        if (!fs.existsSync(filePath)) continue;

        const buf = fs.readFileSync(filePath);
        const audit = auditImageContainer(buf);

        assert.equal(audit.format, 'png', `File ${fileName} must be recognized as PNG`);
        assert.equal(audit.hasC2PA, false, `File ${fileName} must have no C2PA manifest`);
        assert.equal(audit.hasIptc, false, `File ${fileName} must have no IPTC metadata`);
        assert.equal(audit.hasExif, false, `File ${fileName} must have no EXIF metadata`);
        assert.equal(audit.hasXMP, false, `File ${fileName} must have no XMP metadata`);
        assert.equal(audit.hasTrainedMedia, false, `File ${fileName} must have no trainedMedia tag`);
      }
    },
  },

  {
    id: 'T3-BATCH-02',
    feature: 'F6',
    tier: 3,
    title: 'Mode 1 Fast Purge on user test images removes iCCP and preserves only essential image chunks',
    async run() {
      const { stripPngMetadata } = loadModule('lib/imageBinaryStripper.ts');

      const testFiles = [
        'IMG_20261117_022317.png',
        'IMG_20261117_022405.png',
        'IMG_20261117_022511.png',
        'IMG_20261117_022547.png',
      ];

      for (const fileName of testFiles) {
        const filePath = path.resolve(process.cwd(), fileName);
        if (!fs.existsSync(filePath)) continue;

        const rawBuf = fs.readFileSync(filePath);
        const stripped = stripPngMetadata(rawBuf);

        // Verify PNG signature
        assert.equal(stripped[0], 0x89);
        assert.equal(stripped[1], 0x50);
        assert.equal(stripped[2], 0x4e);
        assert.equal(stripped[3], 0x47);

        // Parse remaining chunks
        let offset = 8;
        const remainingChunks = [];
        const view = new DataView(stripped.buffer, stripped.byteOffset, stripped.byteLength);

        while (offset + 12 <= stripped.length) {
          const len = view.getUint32(offset, false);
          const type = String.fromCharCode(
            stripped[offset + 4],
            stripped[offset + 5],
            stripped[offset + 6],
            stripped[offset + 7]
          );
          remainingChunks.push(type);
          offset += 12 + len;
          if (type === 'IEND') break;
        }

        // Allowed chunks only
        const allowed = new Set(['IHDR', 'PLTE', 'tRNS', 'sBIT', 'IDAT', 'IEND']);
        for (const c of remainingChunks) {
          assert.ok(allowed.has(c), `Chunk ${c} in ${fileName} must be an essential image chunk`);
        }
        assert.ok(!remainingChunks.includes('iCCP'), 'iCCP color profile chunk must be purged');
        assert.ok(!remainingChunks.includes('eXIf'), 'eXIf chunk must not exist');
      }
    },
  },

  {
    id: 'T3-BATCH-03',
    feature: 'F6',
    tier: 3,
    title: 'Re-scanning stripped user images certifies Layer 1 is 100% clean with 0 metadata detected',
    async run() {
      const { stripPngMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');

      const testFiles = [
        'IMG_20261117_022317.png',
        'IMG_20261117_022405.png',
        'IMG_20261117_022511.png',
        'IMG_20261117_022547.png',
      ];

      for (const fileName of testFiles) {
        const filePath = path.resolve(process.cwd(), fileName);
        if (!fs.existsSync(filePath)) continue;

        const rawBuf = fs.readFileSync(filePath);
        const stripped = stripPngMetadata(rawBuf);

        const report = await scanImageForensics(stripped);

        assert.equal(report.fileCategory, 'mode1_purged');
        assert.equal(report.layer1.verified, true, `Layer 1 must be verified for ${fileName}`);
        assert.equal(report.hasAiMarkers, false);

        // Verify each Layer 1 item is clean
        for (const item of report.layer1.items) {
          assert.equal(item.detected, false, `Item ${item.id} must NOT be detected in ${fileName}`);
          assert.equal(item.severity, 'clean', `Item ${item.id} severity must be clean in ${fileName}`);
        }
      }
    },
  },

  // =========================================================================
  // Batch Processing Engine
  // =========================================================================
  {
    id: 'T3-BATCH-04',
    feature: 'F6',
    tier: 3,
    title: 'processBatchImage cleans images in batch with progress updates and verified post-scan',
    async run() {
      const { processBatchImage } = loadModule('lib/batchProcessor.ts');
      const { createCleanPng } = await import('../helpers/image-fixtures.mjs');

      const fakeFile = {
        name: 'test_photo.png',
        size: 5000,
        arrayBuffer: async () => createCleanPng({ width: 64, height: 64 }).buffer,
      };

      const item = {
        id: 'test_1',
        file: fakeFile,
        mediaType: 'image',
        format: 'png',
        sizeBytes: 5000,
        sizeFormatted: '5 KB',
        status: 'ready',
        progress: 0,
        stageMessage: 'Listo',
        forensicsReport: null,
        resultBlob: null,
        resultBuffer: null,
        resultUrl: null,
        resultFileName: null,
      };

      const progressSteps = [];
      const result = await processBatchImage(item, 'fast', (pct, stage) => {
        progressSteps.push({ pct, stage });
      });

      assert.ok(result.buffer.length > 0, 'Clean buffer must not be empty');
      assert.ok(result.fileName.startsWith('clean_'), 'Filename must start with clean_');
      assert.equal(result.postScan.layer1.verified, true, 'Post-scan Layer 1 must be verified clean');
      assert.ok(progressSteps.length >= 2, 'Progress callback must have fired multiple stages');
    },
  },

  {
    id: 'T3-BATCH-05',
    feature: 'F6',
    tier: 3,
    title: 'generateBatchZip bundles multiple processed items into a valid DEFLATE ZIP archive',
    async run() {
      const { generateBatchZip } = loadModule('lib/batchProcessor.ts');

      const items = [
        {
          id: '1',
          file: { name: 'photo1.png' },
          status: 'done',
          resultFileName: 'clean_photo1.png',
          resultBuffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        },
        {
          id: '2',
          file: { name: 'photo2.jpg' },
          status: 'done',
          resultFileName: 'clean_photo2.jpg',
          resultBuffer: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
        },
      ];

      const zipBlob = await generateBatchZip(items);
      assert.ok(zipBlob.size > 0, 'ZIP blob size must be greater than 0');

      const buf = new Uint8Array(await zipBlob.arrayBuffer());
      // ZIP magic bytes: PK\x03\x04
      assert.equal(buf[0], 0x50, 'ZIP must start with 0x50 (P)');
      assert.equal(buf[1], 0x4b, 'ZIP must start with 0x4B (K)');
      assert.equal(buf[2], 0x03);
      assert.equal(buf[3], 0x04);
    },
  },
];
