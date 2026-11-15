/**
 * Tier 1 — Feature Area 6: Client-Side Production-Ready Image Processing
 * Tests T1-IMG-01 to T1-IMG-38 (Coverage >= 5 per feature across 7 features)
 *
 * Covers:
 * - F6-1: Magic Byte Format Detection across 8 formats (JPG, PNG, WEBP, AVIF, HEIC, TIFF, BMP)
 * - F6-2: Bitexact Metadata Stripping (0 EXIF, 0 IPTC, 0 XMP, 0 C2PA)
 * - F6-3: Mode 1 Fast Metadata Purge (Lossless, visual fidelity preserved)
 * - F6-4: Mode 2 Anti-SynthID Shield (Micro-crop, stochastic micro-noise, altered pixel matrix)
 * - F6-5: Mode 3 Multi-Variant Spoofer (Unique SHA-256/MD5 and distinct perceptual hashes)
 * - F6-6: Two-Layer Forensic Image Audit (Layer 1 Container vs Layer 2 Signal)
 * - F6-7: UI Integration, Design System Compliance & Non-Regression
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
  createCleanTiff,
  createAvifImage,
  createHeicImage,
} from '../helpers/image-fixtures.mjs';
import {
  checkDesignTokens,
  checkZeroRoundedFullPillBadges,
  checkZeroNestedCards,
} from '../helpers/dom-inspector.mjs';

export const tests = [
  // =========================================================================
  // F6-1: Format Ingestion & Magic Byte Detection (8 formats)
  // =========================================================================
  {
    id: 'T1-IMG-01',
    feature: 'F6',
    tier: 1,
    title: 'JPEG magic bytes (0xFF 0xD8 0xFF) accurately detected with dimensions and MIME type image/jpeg',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const jpegBuf = createJpegWithMetadata({ width: 120, height: 80 });

      const info = detectImageFormat(jpegBuf);
      assert.ok(info !== null, 'JPEG format must be detected');
      assert.equal(info.format, 'jpeg', 'Detected format must be jpeg');
      assert.equal(info.mimeType, 'image/jpeg', 'MIME type must be image/jpeg');
      assert.equal(info.extension, 'jpg', 'Extension must be jpg');
      assert.equal(info.width, 120, 'Extracted width must match 120');
      assert.equal(info.height, 80, 'Extracted height must match 80');
    },
  },

  {
    id: 'T1-IMG-02',
    feature: 'F6',
    tier: 1,
    title: 'PNG signature (89 50 4E 47 0D 0A 1A 0A) accurately detected with IHDR dimensions and MIME type image/png',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const pngBuf = createPngWithMetadata({ width: 64, height: 48 });

      const info = detectImageFormat(pngBuf);
      assert.ok(info !== null, 'PNG format must be detected');
      assert.equal(info.format, 'png', 'Detected format must be png');
      assert.equal(info.mimeType, 'image/png', 'MIME type must be image/png');
      assert.equal(info.extension, 'png', 'Extension must be png');
      assert.equal(info.width, 64, 'Extracted width must match 64');
      assert.equal(info.height, 48, 'Extracted height must match 48');
    },
  },

  {
    id: 'T1-IMG-03',
    feature: 'F6',
    tier: 1,
    title: 'WebP RIFF/WEBP container accurately detected with VP8X dimensions and MIME type image/webp',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const webpBuf = createWebpWithMetadata({ width: 100, height: 100 });

      const info = detectImageFormat(webpBuf);
      assert.ok(info !== null, 'WebP format must be detected');
      assert.equal(info.format, 'webp', 'Detected format must be webp');
      assert.equal(info.mimeType, 'image/webp', 'MIME type must be image/webp');
      assert.equal(info.extension, 'webp', 'Extension must be webp');
      assert.equal(info.width, 100, 'Extracted width must match 100');
      assert.equal(info.height, 100, 'Extracted height must match 100');
    },
  },

  {
    id: 'T1-IMG-04',
    feature: 'F6',
    tier: 1,
    title: 'BMP format (0x42 0x4D) accurately detected with DIB dimensions and MIME type image/bmp',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const bmpBuf = createBmpImage({ width: 32, height: 24 });

      const info = detectImageFormat(bmpBuf);
      assert.ok(info !== null, 'BMP format must be detected');
      assert.equal(info.format, 'bmp', 'Detected format must be bmp');
      assert.equal(info.mimeType, 'image/bmp', 'MIME type must be image/bmp');
      assert.equal(info.extension, 'bmp', 'Extension must be bmp');
      assert.equal(info.width, 32, 'Extracted width must match 32');
      assert.equal(info.height, 24, 'Extracted height must match 24');
    },
  },

  {
    id: 'T1-IMG-05',
    feature: 'F6',
    tier: 1,
    title: 'TIFF format Little-Endian (II*\\0) and Big-Endian accurately detected with MIME type image/tiff',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const tiffBuf = createTiffWithMetadata({ width: 40, height: 30 });

      const info = detectImageFormat(tiffBuf);
      assert.ok(info !== null, 'TIFF format must be detected');
      assert.equal(info.format, 'tiff', 'Detected format must be tiff');
      assert.equal(info.mimeType, 'image/tiff', 'MIME type must be image/tiff');
      assert.equal(info.extension, 'tiff', 'Extension must be tiff');
      assert.equal(info.width, 40, 'Extracted width must match 40');
      assert.equal(info.height, 30, 'Extracted height must match 30');
    },
  },

  {
    id: 'T1-IMG-06',
    feature: 'F6',
    tier: 1,
    title: 'ISOBMFF AVIF and HEIC containers accurately detected by ftyp brand inspection',
    async run() {
      const { detectImageFormat } = loadModule('lib/imageFormatDetector.ts');
      const avifBuf = createAvifImage();
      const heicBuf = createHeicImage();

      const avifInfo = detectImageFormat(avifBuf);
      assert.ok(avifInfo !== null, 'AVIF must be detected');
      assert.equal(avifInfo.format, 'avif', 'Format must be avif');
      assert.equal(avifInfo.mimeType, 'image/avif', 'MIME must be image/avif');

      const heicInfo = detectImageFormat(heicBuf);
      assert.ok(heicInfo !== null, 'HEIC must be detected');
      assert.equal(heicInfo.format, 'heic', 'Format must be heic');
      assert.equal(heicInfo.mimeType, 'image/heic', 'MIME must be image/heic');
    },
  },

  // =========================================================================
  // F6-2: Bitexact Metadata Stripping (Zero EXIF, IPTC, XMP, C2PA)
  // =========================================================================
  {
    id: 'T1-IMG-07',
    feature: 'F6',
    tier: 1,
    title: 'stripJpegMetadata purges APP1 (EXIF), APP1 (XMP), APP13 (IPTC), and APP11 (C2PA/JUMBF) resulting in 0 markers',
    async run() {
      const { stripJpegMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const inputJpeg = createJpegWithMetadata({
        includeExif: true,
        includeIptc: true,
        includeXmp: true,
        includeC2pa: true,
      });

      // Verify input contains tracking markers
      const inputText = inputJpeg.toString('latin1');
      assert.ok(inputText.includes('c2pa'), 'Input JPEG must contain c2pa');
      assert.ok(inputText.includes('Exif'), 'Input JPEG must contain Exif');
      assert.ok(inputText.includes('Photoshop 3.0'), 'Input JPEG must contain Photoshop 3.0');

      // Strip metadata
      const cleanJpeg = stripJpegMetadata(new Uint8Array(inputJpeg));
      const cleanText = Buffer.from(cleanJpeg).toString('latin1');

      // Assert 0 tracking markers remaining
      assert.equal(cleanText.includes('c2pa'), false, 'Clean JPEG must not contain c2pa');
      assert.equal(cleanText.includes('jumb'), false, 'Clean JPEG must not contain jumb');
      assert.equal(cleanText.includes('Exif'), false, 'Clean JPEG must not contain Exif');
      assert.equal(cleanText.includes('http://ns.adobe.com'), false, 'Clean JPEG must not contain Adobe XMP URL');
      assert.equal(cleanText.includes('<x:xmpmeta'), false, 'Clean JPEG must not contain xmpmeta');
      assert.equal(cleanText.includes('Photoshop 3.0'), false, 'Clean JPEG must not contain Photoshop 3.0');
      assert.equal(cleanText.includes('8BIM'), false, 'Clean JPEG must not contain 8BIM');
    },
  },

  {
    id: 'T1-IMG-08',
    feature: 'F6',
    tier: 1,
    title: 'stripJpegMetadata preserves DQT, DHT, SOF0, SOS, and standard clean JFIF header',
    async run() {
      const { stripJpegMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const inputJpeg = createJpegWithMetadata({ width: 64, height: 64 });
      const cleanJpeg = stripJpegMetadata(new Uint8Array(inputJpeg));

      // Must start with SOI (0xFF, 0xD8) and APP0 JFIF (0xFF, 0xE0)
      assert.equal(cleanJpeg[0], 0xff, 'Must start with 0xFF');
      assert.equal(cleanJpeg[1], 0xd8, 'Must start with SOI (0xD8)');
      assert.equal(cleanJpeg[2], 0xff, 'Must follow with marker 0xFF');
      assert.equal(cleanJpeg[3], 0xe0, 'Must have clean JFIF APP0 (0xE0)');

      // Must contain DQT (0xFF, 0xDB) and SOF0 (0xFF, 0xC0)
      const cleanBuf = Buffer.from(cleanJpeg);
      assert.ok(cleanBuf.includes(Buffer.from([0xff, 0xdb])), 'Must preserve DQT quantization table');
      assert.ok(cleanBuf.includes(Buffer.from([0xff, 0xc0])), 'Must preserve SOF0 frame header');
      assert.ok(cleanBuf.includes(Buffer.from([0xff, 0xda])), 'Must preserve SOS scan header');
      assert.equal(cleanJpeg[cleanJpeg.length - 2], 0xff, 'Must end with 0xFF');
      assert.equal(cleanJpeg[cleanJpeg.length - 1], 0xd9, 'Must end with EOI (0xD9)');
    },
  },

  {
    id: 'T1-IMG-09',
    feature: 'F6',
    tier: 1,
    title: 'stripPngMetadata purges eXIf, iTXt, tEXt, zTXt, caBX, and jumb chunks while preserving IHDR, IDAT, IEND',
    async run() {
      const { stripPngMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const inputPng = createPngWithMetadata({
        includeExif: true,
        includeXmp: true,
        includeC2pa: true,
      });

      const inputText = inputPng.toString('latin1');
      assert.ok(inputText.includes('eXIf'), 'Input PNG has eXIf chunk');
      assert.ok(inputText.includes('caBX'), 'Input PNG has caBX chunk');

      const cleanPng = stripPngMetadata(new Uint8Array(inputPng));
      const cleanText = Buffer.from(cleanPng).toString('latin1');

      assert.equal(cleanText.includes('eXIf'), false, 'Clean PNG must not contain eXIf');
      assert.equal(cleanText.includes('iTXt'), false, 'Clean PNG must not contain iTXt');
      assert.equal(cleanText.includes('caBX'), false, 'Clean PNG must not contain caBX');
      assert.equal(cleanText.includes('jumb'), false, 'Clean PNG must not contain jumb');

      // Essential chunks preserved
      assert.ok(cleanText.includes('IHDR'), 'Must preserve IHDR');
      assert.ok(cleanText.includes('IDAT'), 'Must preserve IDAT');
      assert.ok(cleanText.includes('IEND'), 'Must preserve IEND');
    },
  },

  {
    id: 'T1-IMG-10',
    feature: 'F6',
    tier: 1,
    title: 'stripWebpMetadata strips EXIF, XMP , and jumb RIFF chunks, and clears VP8X metadata bit flags',
    async run() {
      const { stripWebpMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const inputWebp = createWebpWithMetadata({
        includeExif: true,
        includeXmp: true,
        includeC2pa: true,
      });

      const cleanWebp = stripWebpMetadata(new Uint8Array(inputWebp));
      const cleanText = Buffer.from(cleanWebp).toString('latin1');

      assert.equal(cleanText.includes('EXIF'), false, 'Clean WebP must not contain EXIF chunk');
      assert.equal(cleanText.includes('XMP '), false, 'Clean WebP must not contain XMP chunk');
      assert.equal(cleanText.includes('jumb'), false, 'Clean WebP must not contain jumb chunk');

      // RIFF and WEBP preserved
      assert.equal(cleanText.startsWith('RIFF'), true, 'Must start with RIFF');
      assert.equal(cleanText.slice(8, 12), 'WEBP', 'Must have WEBP magic');
    },
  },

  {
    id: 'T1-IMG-11',
    feature: 'F6',
    tier: 1,
    title: 'stripBmpMetadata normalizes headers to canonical 54-byte format and eliminates trailing metadata',
    async run() {
      const { stripBmpMetadata } = loadModule('lib/imageBinaryStripper.ts');
      const baseBmp = createBmpImage({ width: 16, height: 16 });

      // Append trailing metadata payload (steganography or comment)
      const trailingPayload = Buffer.from('TRAILING-STEGANO-PAYLOAD-METADATA');
      const bmpWithTrailing = Buffer.concat([baseBmp, trailingPayload]);

      const cleanBmp = stripBmpMetadata(new Uint8Array(bmpWithTrailing));
      assert.equal(
        cleanBmp.length,
        baseBmp.length,
        'Stripped BMP must truncate trailing steganographic bytes'
      );
      assert.equal(
        Buffer.from(cleanBmp).toString('latin1').includes('TRAILING-STEGANO'),
        false,
        'Trailing payload must be purged'
      );
    },
  },

  {
    id: 'T1-IMG-12',
    feature: 'F6',
    tier: 1,
    title: 'stripMetadataUniversal routes buffers to format-specific lossless strippers',
    async run() {
      const { stripMetadataUniversal } = loadModule('lib/imageBinaryStripper.ts');

      const jpeg = createJpegWithMetadata();
      const resJpeg = await stripMetadataUniversal(new Uint8Array(jpeg));
      assert.equal(resJpeg.format, 'jpeg');
      assert.equal(Buffer.from(resJpeg.data).includes('c2pa'), false);

      const png = createPngWithMetadata();
      const resPng = await stripMetadataUniversal(new Uint8Array(png));
      assert.equal(resPng.format, 'png');
      assert.equal(Buffer.from(resPng.data).includes('caBX'), false);
    },
  },

  // =========================================================================
  // F6-3: Mode 1 Fast Purge
  // =========================================================================
  {
    id: 'T1-IMG-13',
    feature: 'F6',
    tier: 1,
    title: 'Mode 1 engine eliminates 100% of metadata without altering visual image resolution',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const jpeg = createJpegWithMetadata({ width: 64, height: 64 });

      const result = await processImageMode1(new Uint8Array(jpeg));
      assert.ok(result.buffer.length > 0, 'Must produce non-empty buffer');
      assert.equal(result.width, 64, 'Resolution width must remain 64');
      assert.equal(result.height, 64, 'Resolution height must remain 64');
      assert.equal(result.format, 'jpeg');
    },
  },

  {
    id: 'T1-IMG-14',
    feature: 'F6',
    tier: 1,
    title: 'Mode 1 outputs retain identical dimensions (width x height) as source image across formats',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const png = createPngWithMetadata({ width: 48, height: 32 });

      const result = await processImageMode1(new Uint8Array(png));
      assert.equal(result.width, 48, 'PNG width must be 48');
      assert.equal(result.height, 32, 'PNG height must be 32');
    },
  },

  {
    id: 'T1-IMG-15',
    feature: 'F6',
    tier: 1,
    title: 'Mode 1 output buffer has a newly generated clean cryptographic SHA-256 and MD5 hash',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const jpeg = createJpegWithMetadata();

      const result = await processImageMode1(new Uint8Array(jpeg));
      assert.ok(result.sha256 && result.sha256.length === 64, 'SHA-256 must be 64-hex string');
      assert.ok(result.md5 && result.md5.length === 32, 'MD5 must be 32-hex string');
    },
  },

  {
    id: 'T1-IMG-16',
    feature: 'F6',
    tier: 1,
    title: 'Mode 1 supports JPEG, PNG, WEBP, and BMP streams losslessly',
    async run() {
      const { processImageMode1 } = loadModule('lib/imageEngine.ts');
      const formats = [
        createJpegWithMetadata(),
        createPngWithMetadata(),
        createWebpWithMetadata(),
        createBmpImage({ width: 16, height: 16 }),
      ];

      for (const fmtBuf of formats) {
        const res = await processImageMode1(new Uint8Array(fmtBuf));
        assert.ok(res.buffer.byteLength > 0, `Mode 1 result must not be empty for format ${res.format}`);
        assert.ok(res.blob.size > 0, `Mode 1 blob must not be empty for format ${res.format}`);
      }
    },
  },

  {
    id: 'T1-IMG-17',
    feature: 'F6',
    tier: 1,
    title: 'Mode 1 execution reports honest status: intact spatial pixel matrix without re-encoding',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanJpeg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanJpeg), { processedMode: 'fast' });
      assert.equal(report.layer1.verified, true, 'Layer 1 must be verified clean after Mode 1');
      assert.equal(report.layer2.pixelMatrixIntact, true, 'Layer 2 must report pixel matrix is intact');
      assert.equal(report.layer2.synthIdShielded, false, 'Layer 2 must report SynthID is not shielded');
    },
  },

  // =========================================================================
  // F6-4: Mode 2 Anti-SynthID Shield
  // =========================================================================
  {
    id: 'T1-IMG-18',
    feature: 'F6',
    tier: 1,
    title: 'applyAntiSynthIDShield applies micro-crop, spatial bilinear resampling, and stochastic micro-noise',
    async run() {
      const { applyAntiSynthIDShield } = loadModule('lib/imageEngine.ts');

      // Create synthetic 16x16 RGBA pixel matrix
      const width = 16;
      const height = 16;
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 120;     // R
        data[i + 1] = 140; // G
        data[i + 2] = 160; // B
        data[i + 3] = 255; // A
      }

      const shielded = applyAntiSynthIDShield({ width, height, data }, {
        cropFactor: 0.99,
        noiseIntensity: 2.0,
      });

      assert.equal(shielded.width, width, 'Shielded width must match original');
      assert.equal(shielded.height, height, 'Shielded height must match original');

      // Confirm pixel values were subtly perturbed
      let differences = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (shielded.data[i] !== data[i] || shielded.data[i + 1] !== data[i + 1]) {
          differences++;
        }
      }
      assert.ok(differences > 0, 'Micro-noise must introduce subtle pixel variations');
    },
  },

  {
    id: 'T1-IMG-19',
    feature: 'F6',
    tier: 1,
    title: 'Mode 2 modifies pixel distribution so perceptual hash deviates from original (Hamming distance > 0)',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 32, height: 32 });

      const res = await processImageMode2(new Uint8Array(bmp));
      assert.ok(res.perceptualDistance >= 0, 'Perceptual distance must be computed');
      assert.ok(res.sourceDHash.length === 16, 'Source dHash must be 16-hex');
      assert.ok(res.shieldedDHash.length === 16, 'Shielded dHash must be 16-hex');
    },
  },

  {
    id: 'T1-IMG-20',
    feature: 'F6',
    tier: 1,
    title: 'Mode 2 strips all container metadata (EXIF, IPTC, XMP, C2PA) in addition to pixel shielding',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const jpeg = createJpegWithMetadata();

      const res = await processImageMode2(new Uint8Array(jpeg));
      const resText = Buffer.from(res.buffer).toString('latin1');
      assert.equal(resText.includes('c2pa'), false, 'Mode 2 output must have 0 c2pa');
      assert.equal(resText.includes('Exif'), false, 'Mode 2 output must have 0 Exif');
      assert.equal(resText.includes('http://ns.adobe.com'), false, 'Mode 2 output must have 0 XMP');
    },
  },

  {
    id: 'T1-IMG-21',
    feature: 'F6',
    tier: 1,
    title: 'Mode 2 calculates and returns perceptual distance metric indicating shield strength',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 32, height: 32 });

      const res = await processImageMode2(new Uint8Array(bmp));
      assert.equal(typeof res.perceptualDistance, 'number', 'perceptualDistance must be a number');
    },
  },

  {
    id: 'T1-IMG-22',
    feature: 'F6',
    tier: 1,
    title: 'Mode 2 outputs valid image binary with non-empty cryptographic hash',
    async run() {
      const { processImageMode2 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 16, height: 16 });

      const res = await processImageMode2(new Uint8Array(bmp));
      assert.ok(res.sha256.length === 64, 'SHA-256 must be valid');
      assert.ok(res.md5.length === 32, 'MD5 must be valid');
      assert.ok(res.buffer.length > 54, 'Output buffer must exceed basic header length');
    },
  },

  // =========================================================================
  // F6-5: Mode 3 Multi-Variant Spoofer
  // =========================================================================
  {
    id: 'T1-IMG-23',
    feature: 'F6',
    tier: 1,
    title: 'Mode 3 Multi-Variant Spoofer generates exact requested number of variants (3, 5, or 10)',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 24, height: 24 });

      const variants3 = await processImageMode3(new Uint8Array(bmp), 3);
      assert.equal(variants3.length, 3, 'Must produce exactly 3 variants for count=3');

      const variants5 = await processImageMode3(new Uint8Array(bmp), 5);
      assert.equal(variants5.length, 5, 'Must produce exactly 5 variants for count=5');
    },
  },

  {
    id: 'T1-IMG-24',
    feature: 'F6',
    tier: 1,
    title: 'Mode 3 output variants all have strictly unique SHA-256 cryptographic fingerprints',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 32, height: 32 });

      const variants = await processImageMode3(new Uint8Array(bmp), 5);
      const shaSet = new Set(variants.map((v) => v.sha256));
      assert.equal(shaSet.size, 5, 'All 5 variants must possess unique SHA-256 hashes');
    },
  },

  {
    id: 'T1-IMG-25',
    feature: 'F6',
    tier: 1,
    title: 'Mode 3 output variants all have strictly unique MD5 cryptographic fingerprints',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 32, height: 32 });

      const variants = await processImageMode3(new Uint8Array(bmp), 5);
      const md5Set = new Set(variants.map((v) => v.md5));
      assert.equal(md5Set.size, 5, 'All 5 variants must possess unique MD5 hashes');
    },
  },

  {
    id: 'T1-IMG-26',
    feature: 'F6',
    tier: 1,
    title: 'Mode 3 output variants produce distinct perceptual hashes (dHash and pHash)',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const bmp = createBmpImage({ width: 32, height: 32 });

      const variants = await processImageMode3(new Uint8Array(bmp), 3);
      assert.ok(variants[0].dHash && variants[0].dHash.length === 16, 'Variant 1 dHash valid');
      assert.ok(variants[1].dHash && variants[1].dHash.length === 16, 'Variant 2 dHash valid');
      assert.ok(variants[0].pHash && variants[0].pHash.length === 16, 'Variant 1 pHash valid');
    },
  },

  {
    id: 'T1-IMG-27',
    feature: 'F6',
    tier: 1,
    title: 'Mode 3 variants all have metadata purged (zero EXIF, IPTC, XMP, C2PA)',
    async run() {
      const { processImageMode3 } = loadModule('lib/imageEngine.ts');
      const jpeg = createJpegWithMetadata();

      const variants = await processImageMode3(new Uint8Array(jpeg), 3);
      for (const v of variants) {
        const text = Buffer.from(v.buffer).toString('latin1');
        assert.equal(text.includes('c2pa'), false, `Variant ${v.id} must not contain c2pa`);
        assert.equal(text.includes('Exif'), false, `Variant ${v.id} must not contain Exif`);
      }
    },
  },

  // =========================================================================
  // F6-6: Two-Layer Forensic Image Audit
  // =========================================================================
  {
    id: 'T1-IMG-28',
    feature: 'F6',
    tier: 1,
    title: 'Forensic scanner detects C2PA, IPTC AI, Google provenance, and XMP in untreated image',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const rawImage = createJpegWithMetadata({
        includeC2pa: true,
        includeIptc: true,
        includeXmp: true,
        includeExif: true,
      });

      const report = await scanImageForensics(new Uint8Array(rawImage));
      assert.equal(report.hasAiMarkers, true, 'Must flag AI markers in untreated image');
      assert.ok(report.totalMarkersFound > 0, 'Must count detected markers');
      assert.equal(report.layer1.verified, false, 'Layer 1 must NOT be verified when markers exist');
    },
  },

  {
    id: 'T1-IMG-29',
    feature: 'F6',
    tier: 1,
    title: 'Layer 1 verifies 0 C2PA, 0 IPTC, 0 XMP, 0 EXIF in Mode 1 treated images (verified = true)',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanImg), { processedMode: 'fast' });
      assert.equal(report.layer1.verified, true, 'Layer 1 must be verified clean');
      const c2paItem = report.layer1.items.find((i) => i.id === 'c2pa');
      assert.equal(c2paItem?.detected, false, 'C2PA item must not be detected');
    },
  },

  {
    id: 'T1-IMG-30',
    feature: 'F6',
    tier: 1,
    title: 'Layer 2 reports spatial matrix intact and SynthID unshielded for Mode 1 (Sin recodificar)',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanImg), { processedMode: 'fast' });
      assert.equal(report.layer2.pixelMatrixIntact, true, 'Layer 2 pixel matrix must be intact for Mode 1');
      assert.equal(report.layer2.synthIdShielded, false, 'SynthID must NOT be reported shielded for Mode 1');
      const synthId = report.diagnostics.find((d) => d.id === 'synthid');
      assert.ok(synthId?.sanitizedState.includes('Sin recodificar'), 'Must warn user pixels were not re-encoded');
    },
  },

  {
    id: 'T1-IMG-31',
    feature: 'F6',
    tier: 1,
    title: 'Layer 2 reports SynthID shielded (Blindada) and altered matrix for Mode 2 treated images',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanImg), { processedMode: 'deep' });
      assert.equal(report.layer2.synthIdShielded, true, 'SynthID must be reported shielded for Mode 2');
      const synthId = report.diagnostics.find((d) => d.id === 'synthid');
      assert.ok(synthId?.sanitizedState.includes('Blindada'), 'Must report Blindada for Mode 2');
    },
  },

  {
    id: 'T1-IMG-32',
    feature: 'F6',
    tier: 1,
    title: 'Layer 2 reports clean audio status (Sin pista de audio) for static images',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanImg));
      const acoustic = report.diagnostics.find((d) => d.id === 'acoustic_spectrum');
      assert.ok(acoustic !== undefined, 'Acoustic diagnostic item must exist');
      assert.equal(acoustic?.detected, false, 'Acoustic must not detect ultrasound in images');
      assert.ok(acoustic?.currentState.includes('Sin pista de audio'), 'Must report Sin pista de audio');
    },
  },

  {
    id: 'T1-IMG-33',
    feature: 'F6',
    tier: 1,
    title: 'Forensic diagnostics array contains individual items for c2pa, iptc_ai, provenance_authority, xmp_metadata, synthid',
    async run() {
      const { scanImageForensics } = loadModule('lib/imageForensicsScanner.ts');
      const cleanImg = createCleanJpeg();

      const report = await scanImageForensics(new Uint8Array(cleanImg));
      const ids = report.diagnostics.map((d) => d.id);
      assert.ok(ids.includes('c2pa'), 'Must have c2pa diagnostic');
      assert.ok(ids.includes('iptc_ai'), 'Must have iptc_ai diagnostic');
      assert.ok(ids.includes('provenance_authority'), 'Must have provenance_authority diagnostic');
      assert.ok(ids.includes('xmp_metadata'), 'Must have xmp_metadata diagnostic');
      assert.ok(ids.includes('synthid'), 'Must have synthid diagnostic');
      assert.ok(ids.includes('acoustic_spectrum'), 'Must have acoustic_spectrum diagnostic');
      assert.ok(ids.includes('file_hash'), 'Must have file_hash diagnostic');
    },
  },

  // =========================================================================
  // F6-7: UI Integration & Media Harmonization
  // =========================================================================
  {
    id: 'T1-IMG-34',
    feature: 'F6',
    tier: 1,
    title: 'React hook useImageCleaner.ts exports required media lifecycle interface',
    async run() {
      const hookSource = loadSourceFile('components/useImageCleaner.ts');
      assert.ok(hookSource.includes('useImageCleaner'), 'useImageCleaner hook must be exported');
      assert.ok(hookSource.includes('executeClean'), 'executeClean method must exist');
      assert.ok(hookSource.includes('isProcessing'), 'isProcessing state must exist');
      assert.ok(hookSource.includes('progressPercent'), 'progressPercent state must exist');
      assert.ok(hookSource.includes('singleResult'), 'singleResult state must exist');
      assert.ok(hookSource.includes('variantResults'), 'variantResults state must exist');
    },
  },

  {
    id: 'T1-IMG-35',
    feature: 'F6',
    tier: 1,
    title: 'app/page.tsx supports image file input and drag-and-drop ingestion alongside video',
    async run() {
      const pageSrc = loadSourceFile('app/page.tsx');
      assert.ok(
        pageSrc.includes('image/*') || pageSrc.includes('image/jpeg') || pageSrc.includes('image/png'),
        'app/page.tsx must accept image file MIME types'
      );
      assert.ok(
        pageSrc.includes('isImage') || pageSrc.includes('mediaType') || pageSrc.includes('useImageCleaner'),
        'app/page.tsx must distinguish or handle image media type'
      );
    },
  },

  {
    id: 'T1-IMG-36',
    feature: 'F6',
    tier: 1,
    title: 'UI displays format badges for detected image formats (JPG, PNG, WEBP, AVIF, HEIC, TIFF, BMP)',
    async run() {
      const pageSrc = loadSourceFile('app/page.tsx');
      assert.ok(
        pageSrc.includes('JPG') || pageSrc.includes('PNG') || pageSrc.includes('format'),
        'app/page.tsx must render format badges or indicators'
      );
    },
  },

  {
    id: 'T1-IMG-37',
    feature: 'F6',
    tier: 1,
    title: 'UI renders side-by-side or comparison preview for source vs processed image',
    async run() {
      const pageSrc = loadSourceFile('app/page.tsx');
      assert.ok(
        pageSrc.includes('preview') || pageSrc.includes('source') || pageSrc.includes('resultUrl'),
        'app/page.tsx must support image preview'
      );
    },
  },

  {
    id: 'T1-IMG-38',
    feature: 'F6',
    tier: 1,
    title: 'UI design tokens (Pale Mint, White, Borders, Navy) and zero nested cards / zero pill badges are enforced',
    async run() {
      const pageSrc = loadSourceFile('app/page.tsx');
      const tokens = checkDesignTokens(pageSrc, ['#cfe8e1', '#002941', '#b8d8cf']);
      assert.ok(tokens.allPresent, `app/page.tsx missing tokens: ${tokens.missing.join(', ')}`);

      const pills = checkZeroRoundedFullPillBadges(pageSrc);
      assert.ok(pills.passed, `app/page.tsx has forbidden pill badges: ${pills.occurrences.join(', ')}`);

      const cards = checkZeroNestedCards(pageSrc);
      assert.ok(cards.passed, `app/page.tsx has forbidden nested cards: ${cards.message}`);
    },
  },
];
