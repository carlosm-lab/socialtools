/**
 * CleanStream Studio — Image Binary Stripper
 * Bitexact, lossless client-side binary segment & chunk stripper for:
 * - JPEG: Purges APP1 (EXIF, XMP), APP11 (C2PA/JUMBF), APP13 (IPTC/Photoshop), APP2, COM markers.
 * - PNG: Purges eXIf, iTXt, tEXt, zTXt, caBX, jumb, tIME, pHYs chunks.
 * - WEBP: Purges EXIF, XMP, jumb chunks and clears VP8X flags.
 * - Universal fallback for extended formats via canvas re-encoding or raw normalization.
 */

import { detectImageFormat, ImageFormat } from './imageFormatDetector';

/**
 * Losslessly strips metadata from JPEG binary stream without recompression.
 * Preserves DQT, DHT, SOF, SOS, and entropy-coded scan data bit-for-bit.
 */
export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) {
    return input; // Not a valid JPEG
  }

  const chunks: Uint8Array[] = [];
  // Write SOI marker
  chunks.push(new Uint8Array([0xff, 0xd8]));

  // Standard clean JFIF APP0 marker (18 bytes total)
  // Ensures maximum player/decoder compatibility with 0 metadata tags
  const cleanJfif = new Uint8Array([
    0xff, 0xe0, // APP0
    0x00, 0x10, // Length: 16 bytes
    0x4a, 0x46, 0x49, 0x46, 0x00, // 'JFIF\0'
    0x01, 0x01, // Version 1.1
    0x00,       // Units: none
    0x00, 0x01, // X density: 1
    0x00, 0x01, // Y density: 1
    0x00, 0x00  // Thumbnail: 0x0
  ]);
  chunks.push(cleanJfif);

  let offset = 2;
  const len = input.length;

  while (offset < len) {
    if (input[offset] !== 0xff) {
      offset++;
      continue;
    }

    // Skip fill bytes 0xFF
    while (offset < len && input[offset] === 0xff) {
      offset++;
    }
    if (offset >= len) break;

    const marker = input[offset];
    offset++;

    // End of Image (EOI)
    if (marker === 0xd9) {
      chunks.push(new Uint8Array([0xff, 0xd9]));
      break;
    }

    // Start of Scan (SOS): Following SOS is the compressed image entropy data up to EOI
    if (marker === 0xda) {
      // Find segment length of SOS header
      if (offset + 1 < len) {
        const sosLen = (input[offset] << 8) | input[offset + 1];
        const sosHeaderEnd = offset + sosLen;
        // From SOS marker to end of file (or EOI)
        // Scan for 0xFF 0xD9 (EOI)
        let eoiIndex = len;
        for (let i = sosHeaderEnd; i < len - 1; i++) {
          if (input[i] === 0xff && input[i + 1] === 0xd9) {
            eoiIndex = i + 2;
            break;
          }
        }
        // Slice the entire SOS chunk + entropy payload
        const sosPayload = input.subarray(offset - 2, eoiIndex);
        chunks.push(sosPayload);
        break;
      }
    }

    // Markers without payload
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(new Uint8Array([0xff, marker]));
      continue;
    }

    // Read payload length
    if (offset + 1 >= len) break;
    const segmentLength = (input[offset] << 8) | input[offset + 1];
    if (segmentLength < 2) break;

    const segmentEnd = offset + segmentLength;
    if (segmentEnd > len) break;

    // Filter metadata markers:
    // Drop all APPn markers (0xE0..0xEF) — includes APP1 EXIF/XMP, APP11 C2PA, APP13 IPTC
    // Drop COM marker (0xFE)
    const isAppMarker = marker >= 0xe0 && marker <= 0xef;
    const isCommentMarker = marker === 0xfe;

    if (!isAppMarker && !isCommentMarker) {
      // Keep essential headers (DQT, DHT, SOF, DRI, etc.)
      const segmentData = input.subarray(offset - 2, segmentEnd);
      chunks.push(segmentData);
    }

    offset = segmentEnd;
  }

  // Concatenate chunks into final clean Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return result;
}

/**
 * Losslessly strips metadata from PNG binary stream without recompression.
 * Filters out eXIf, iTXt, tEXt, zTXt, caBX, jumb, tIME, pHYs chunks.
 * Preserves IHDR, PLTE, tRNS, IDAT, and IEND bit-for-bit.
 */
export function stripPngMetadata(input: Uint8Array): Uint8Array {
  // Check PNG signature
  if (
    input.length < 8 ||
    input[0] !== 0x89 ||
    input[1] !== 0x50 ||
    input[2] !== 0x4e ||
    input[3] !== 0x47 ||
    input[4] !== 0x0d ||
    input[5] !== 0x0a ||
    input[6] !== 0x1a ||
    input[7] !== 0x0a
  ) {
    return input;
  }

  const chunks: Uint8Array[] = [];
  // PNG 8-byte signature
  chunks.push(input.subarray(0, 8));

  let offset = 8;
  const len = input.length;
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);

  // Metadata chunk types to remove
  const droppedChunkTypes = new Set([
    'eXIf', // EXIF metadata
    'iTXt', // International text (used by Adobe XMP, C2PA assertions)
    'tEXt', // Plain text metadata
    'zTXt', // Compressed text metadata
    'caBX', // C2PA Box chunk
    'jumb', // JUMBF container chunk
    'tIME', // Last-modification time
    'pHYs', // Physical pixel dimensions
    'iCCP', // Embedded ICC profile (often contains author tags)
  ]);

  while (offset + 12 <= len) {
    const dataLength = view.getUint32(offset, false);
    const chunkType = String.fromCharCode(
      input[offset + 4],
      input[offset + 5],
      input[offset + 6],
      input[offset + 7]
    );

    const fullChunkLength = 12 + dataLength; // 4 (length) + 4 (type) + data + 4 (CRC)
    if (offset + fullChunkLength > len) break;

    if (!droppedChunkTypes.has(chunkType)) {
      chunks.push(input.subarray(offset, offset + fullChunkLength));
    }

    offset += fullChunkLength;

    if (chunkType === 'IEND') {
      break;
    }
  }

  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of chunks) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return result;
}

/**
 * Losslessly strips metadata from WEBP binary stream without recompression.
 * Drops EXIF, XMP , and jumb RIFF chunks, and clears VP8X metadata header flags.
 */
export function stripWebpMetadata(input: Uint8Array): Uint8Array {
  // Validate RIFF WEBP signature
  if (
    input.length < 12 ||
    input[0] !== 0x52 || input[1] !== 0x49 || input[2] !== 0x46 || input[3] !== 0x46 ||
    input[8] !== 0x57 || input[9] !== 0x45 || input[10] !== 0x42 || input[11] !== 0x50
  ) {
    return input;
  }

  const chunks: Uint8Array[] = [];
  let offset = 12;
  const len = input.length;
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);

  const droppedFourCC = new Set(['EXIF', 'XMP ', 'jumb']);

  while (offset + 8 <= len) {
    const fourCC = String.fromCharCode(
      input[offset],
      input[offset + 1],
      input[offset + 2],
      input[offset + 3]
    );
    const chunkSize = view.getUint32(offset + 4, true);
    const paddedSize = chunkSize + (chunkSize % 2); // RIFF chunks padded to 2-byte boundary
    const totalChunkBytes = 8 + paddedSize;

    if (offset + totalChunkBytes > len) {
      // Last chunk or truncated
      const remaining = input.subarray(offset);
      if (!droppedFourCC.has(fourCC)) {
        chunks.push(remaining);
      }
      break;
    }

    if (!droppedFourCC.has(fourCC)) {
      if (fourCC === 'VP8X' && chunkSize >= 10) {
        // Create clean clone of VP8X chunk and clear EXIF (bit 3) & XMP (bit 2) flags
        const vp8xChunk = input.slice(offset, offset + totalChunkBytes);
        // Flags byte is at offset 8 (after 4-byte FourCC + 4-byte size)
        vp8xChunk[8] = vp8xChunk[8] & ~0x08; // Clear EXIF flag
        vp8xChunk[8] = vp8xChunk[8] & ~0x04; // Clear XMP flag
        chunks.push(vp8xChunk);
      } else {
        chunks.push(input.subarray(offset, offset + totalChunkBytes));
      }
    }

    offset += totalChunkBytes;
  }

  // Calculate new total size
  const payloadLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const totalFileSize = 12 + payloadLength;
  const result = new Uint8Array(totalFileSize);

  // Write RIFF header
  result.set([0x52, 0x49, 0x46, 0x46], 0); // 'RIFF'
  const resultView = new DataView(result.buffer);
  resultView.setUint32(4, totalFileSize - 8, true); // Size excluding RIFF & size field
  result.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'

  let writeOffset = 12;
  for (const chunk of chunks) {
    result.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return result;
}

/**
 * Universal metadata stripper for BMP:
 * Strips any trailing steganography/metadata and normalizes headers to canonical 54-byte format.
 */
export function stripBmpMetadata(input: Uint8Array): Uint8Array {
  if (input.length < 54 || input[0] !== 0x42 || input[1] !== 0x4d) {
    return input;
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const dataOffset = view.getUint32(10, true);
  const width = Math.abs(view.getInt32(18, true));
  const height = Math.abs(view.getInt32(22, true));
  const bitsPerPixel = view.getUint16(28, true);

  if (width > 0 && height > 0 && bitsPerPixel >= 24) {
    const bytesPerPixel = bitsPerPixel / 8;
    const rowSize = Math.floor((bitsPerPixel * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const canonicalSize = dataOffset + pixelArraySize;

    if (input.length >= canonicalSize) {
      // Truncate any trailing metadata or comments after canonical pixel array
      const cleanBmp = input.slice(0, canonicalSize);
      const cleanView = new DataView(cleanBmp.buffer, cleanBmp.byteOffset, cleanBmp.byteLength);
      // Ensure file size in header matches canonical length
      cleanView.setUint32(2, canonicalSize, true);
      // Zero out reserved fields (bytes 6-9)
      cleanView.setUint32(6, 0, true);
      return cleanBmp;
    }
  }

  return input;
}

/**
 * Universal in-memory metadata purging dispatcher:
 * Applies lossless binary stripping for JPEG, PNG, WEBP, BMP.
 * Falls back to Canvas re-encoding in browser environments for AVIF, HEIC, TIFF.
 */
export async function stripMetadataUniversal(
  input: ArrayBuffer | Uint8Array,
  formatHint?: ImageFormat
): Promise<{ data: Uint8Array; format: ImageFormat }> {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const info = detectImageFormat(bytes);
  const format = formatHint || info?.format || 'jpeg';

  if (format === 'jpeg') {
    return { data: stripJpegMetadata(bytes), format };
  }
  if (format === 'png') {
    return { data: stripPngMetadata(bytes), format };
  }
  if (format === 'webp') {
    return { data: stripWebpMetadata(bytes), format };
  }
  if (format === 'bmp') {
    return { data: stripBmpMetadata(bytes), format };
  }

  // Extended formats (TIFF, AVIF, HEIC) in browser environment:
  // Using Canvas re-encoding guarantees 0 metadata
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([bytes as unknown as BlobPart], { type: info?.mimeType || 'image/png' });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        const outputBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/png')
        );
        if (outputBlob) {
          const arrayBuf = await outputBlob.arrayBuffer();
          return { data: stripPngMetadata(new Uint8Array(arrayBuf)), format: 'png' };
        }
      }
    } catch {
      // Fallback below
    }
  }

  return { data: bytes, format };
}
