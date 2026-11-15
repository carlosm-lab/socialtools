/**
 * CleanStream Studio — Image Format Detector
 * Fast, deterministic client-side magic byte inspection for image formats:
 * JPG/JPEG, PNG, WEBP, AVIF, HEIC, TIFF, BMP.
 * Extracts format, MIME type, canonical extension, and dimensional metadata.
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'heic' | 'tiff' | 'bmp';

export interface ImageFormatInfo {
  format: ImageFormat;
  mimeType: string;
  extension: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
}

/**
 * Detects image format from binary magic bytes (Uint8Array or ArrayBuffer).
 * Zero server upload, runs 100% in-memory in browser or Node.js.
 */
export function detectImageFormat(
  input: ArrayBuffer | Uint8Array
): ImageFormatInfo | null {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 4) return null;

  // 1. JPEG: 0xFF 0xD8 0xFF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    const dims = extractJpegDimensions(bytes);
    return {
      format: 'jpeg',
      mimeType: 'image/jpeg',
      extension: 'jpg',
      width: dims?.width,
      height: dims?.height,
      fileSizeBytes: bytes.byteLength,
    };
  }

  // 2. PNG: 0x89 'PNG' 0x0D 0x0A 0x1A 0x0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    const dims = extractPngDimensions(bytes);
    return {
      format: 'png',
      mimeType: 'image/png',
      extension: 'png',
      width: dims?.width,
      height: dims?.height,
      fileSizeBytes: bytes.byteLength,
    };
  }

  // 3. WEBP: 'RIFF' .... 'WEBP'
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const dims = extractWebpDimensions(bytes);
    return {
      format: 'webp',
      mimeType: 'image/webp',
      extension: 'webp',
      width: dims?.width,
      height: dims?.height,
      fileSizeBytes: bytes.byteLength,
    };
  }

  // 4. BMP: 'BM' (0x42, 0x4D)
  if (bytes.length >= 14 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    const dims = extractBmpDimensions(bytes);
    return {
      format: 'bmp',
      mimeType: 'image/bmp',
      extension: 'bmp',
      width: dims?.width,
      height: dims?.height,
      fileSizeBytes: bytes.byteLength,
    };
  }

  // 5. TIFF: 'II*\0' (Intel LE) or 'MM\0*' (Motorola BE) or BigTIFF ('II+\0' / 'MM\0+')
  if (
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a) ||
    (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2b && bytes[3] === 0x00) ||
    (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2b)
  ) {
    const dims = extractTiffDimensions(bytes);
    return {
      format: 'tiff',
      mimeType: 'image/tiff',
      extension: 'tiff',
      width: dims?.width,
      height: dims?.height,
      fileSizeBytes: bytes.byteLength,
    };
  }

  // 6. ISOBMFF: AVIF & HEIC / HEIF (ftyp box at byte 4)
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    const boxLength = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const maxScan = Math.min(bytes.length, Math.max(12, boxLength > 0 ? boxLength : 64));
    let ftypSlice = '';
    for (let i = 8; i < maxScan; i++) {
      ftypSlice += String.fromCharCode(bytes[i]);
    }

    if (ftypSlice.includes('avif') || ftypSlice.includes('avis')) {
      return {
        format: 'avif',
        mimeType: 'image/avif',
        extension: 'avif',
        fileSizeBytes: bytes.byteLength,
      };
    }

    if (
      ftypSlice.includes('heic') ||
      ftypSlice.includes('heix') ||
      ftypSlice.includes('mif1') ||
      ftypSlice.includes('msf1') ||
      ftypSlice.includes('hevc') ||
      ftypSlice.includes('hevx')
    ) {
      return {
        format: 'heic',
        mimeType: 'image/heic',
        extension: 'heic',
        fileSizeBytes: bytes.byteLength,
      };
    }
  }

  return null;
}

/**
 * Helper to check if a file / buffer is an image
 */
export function isImageBuffer(input: ArrayBuffer | Uint8Array): boolean {
  return detectImageFormat(input) !== null;
}

/**
 * Extracts PNG dimensions from IHDR chunk
 */
function extractPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  // IHDR starts at offset 12; width at 16 (4 bytes BE), height at 20 (4 bytes BE)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Extracts BMP dimensions from DIB header
 */
function extractBmpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 26) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dibHeaderSize = view.getUint32(14, true);
  if (dibHeaderSize >= 40 && bytes.length >= 26) {
    const width = Math.abs(view.getInt32(18, true));
    const height = Math.abs(view.getInt32(22, true));
    return width > 0 && height > 0 ? { width, height } : null;
  }
  return null;
}

/**
 * Extracts JPEG dimensions by walking markers to Start Of Frame (SOF)
 */
function extractJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  const len = bytes.length;

  while (offset < len - 8) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];

    // SOF markers (SOF0=0xC0, SOF1=0xC1, SOF2=0xC2, SOF3=0xC3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15)
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSof && offset + 8 < len) {
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }

    if (marker === 0xda || marker === 0xd9) {
      // SOS (Start of Scan) or EOI (End of Image) — stop scanning
      break;
    }

    // Advance by segment length (2 bytes BE following marker)
    if (offset + 3 < len) {
      const segmentLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segmentLen < 2) break;
      offset += 2 + segmentLen;
    } else {
      break;
    }
  }

  return null;
}

/**
 * Extracts WebP dimensions (supports VP8 lossy, VP8L lossless, and VP8X extended)
 */
function extractWebpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunkFourCC = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

  if (chunkFourCC === 'VP8X' && bytes.length >= 30) {
    // 24-bit canvas width-1 at offset 24..26 (little endian)
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    // 24-bit canvas height-1 at offset 27..29 (little endian)
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }

  if (chunkFourCC === 'VP8 ' && bytes.length >= 30) {
    // Check 3-byte keyframe code: 0x9D 0x01 0x2A
    if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      const width = (bytes[26] | ((bytes[27] & 0x3f) << 8));
      const height = (bytes[28] | ((bytes[29] & 0x3f) << 8));
      return { width, height };
    }
  }

  if (chunkFourCC === 'VP8L' && bytes.length >= 25) {
    // Lossless signature is 0x2F at offset 20
    if (bytes[20] === 0x2f) {
      const b0 = bytes[21];
      const b1 = bytes[22];
      const b2 = bytes[23];
      const b3 = bytes[24];
      const width = 1 + (b0 | ((b1 & 0x3f) << 8));
      const height = 1 + (((b1 >> 6) | (b2 << 2) | ((b3 & 0x0f) << 10)));
      return { width, height };
    }
  }

  return null;
}

/**
 * Extracts TIFF dimensions from IFD0 tags
 */
function extractTiffDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 18) return null;
  const isLE = bytes[0] === 0x49; // Intel Little Endian
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  try {
    const ifdOffset = view.getUint32(4, isLE);
    if (ifdOffset + 2 > bytes.length) return null;
    const numEntries = view.getUint16(ifdOffset, isLE);

    let width: number | undefined;
    let height: number | undefined;

    let entryOffset = ifdOffset + 2;
    for (let i = 0; i < numEntries && entryOffset + 12 <= bytes.length; i++) {
      const tag = view.getUint16(entryOffset, isLE);
      const type = view.getUint16(entryOffset + 2, isLE);

      // Tag 0x0100 = ImageWidth, 0x0101 = ImageLength
      if (tag === 0x0100 || tag === 0x0101) {
        let val: number | undefined;
        if (type === 3) {
          // SHORT (2 bytes)
          val = view.getUint16(entryOffset + 8, isLE);
        } else if (type === 4) {
          // LONG (4 bytes)
          val = view.getUint32(entryOffset + 8, isLE);
        }
        if (tag === 0x0100) width = val;
        if (tag === 0x0101) height = val;
      }

      if (width !== undefined && height !== undefined) {
        return { width, height };
      }
      entryOffset += 12;
    }
  } catch {
    return null;
  }

  return null;
}
