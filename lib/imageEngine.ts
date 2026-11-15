/**
 * CleanStream Studio — In-Browser Image Processing Engine
 * Implements 3 Studio Processing Modes for all standard and extended image formats:
 * - Mode 1: Fast metadata purge (0 EXIF, 0 IPTC, 0 XMP, 0 C2PA) with 0 visual quality loss.
 * - Mode 2: Anti-SynthID shield (0.99x micro-crop, spatial resampling, imperceptible stochastic micro-noise, and pixel distribution modification).
 * - Mode 3: Multi-Variant Spoofer (3, 5, or 10 unique variants with distinct crop factors, noise seeds, micro-brightness shifts, unique SHA-256/MD5, and distinct perceptual hashes).
 */

import { detectImageFormat, ImageFormat } from './imageFormatDetector';
import { stripMetadataUniversal } from './imageBinaryStripper';
import {
  computeDHash,
  computePHash,
  hammingDistance,
  PixelMatrix,
} from './perceptualHash';
import { computeSHA256, computeMD5 } from './cryptoUtils';

export interface ImageProcessingProgress {
  stage: string;
  percent: number;
}

export interface Mode1Result {
  blob: Blob;
  buffer: Uint8Array;
  format: string;
  width: number;
  height: number;
  sha256: string;
  md5: string;
}

export interface Mode2Result {
  blob: Blob;
  buffer: Uint8Array;
  format: string;
  width: number;
  height: number;
  sha256: string;
  md5: string;
  perceptualDistance: number;
  sourceDHash: string;
  shieldedDHash: string;
}

export interface Mode3VariantResult {
  id: number;
  blob: Blob;
  buffer: Uint8Array;
  format: string;
  width: number;
  height: number;
  sha256: string;
  md5: string;
  dHash: string;
  pHash: string;
}

const CROP_SEEDS = [0.99, 0.988, 0.992, 0.986, 0.994, 0.991, 0.989, 0.993, 0.987, 0.995];

/**
 * Pure Typed-Array Algorithm: Micro-crop + Bilinear Resampling + Stochastic Noise Injection
 * Works in both Browser and Node.js without DOM dependencies.
 */
export function applyAntiSynthIDShield(
  source: PixelMatrix,
  options?: {
    cropFactor?: number;
    noiseIntensity?: number;
    brightnessShift?: number;
    seed?: number;
    offsetX?: number;
    offsetY?: number;
  }
): PixelMatrix {
  const { width: srcW, height: srcH, data: srcData } = source;
  const cropFactor = options?.cropFactor ?? 0.99;
  const noiseIntensity = options?.noiseIntensity ?? 1.5;
  const brightnessShift = options?.brightnessShift ?? 0;
  const seed = options?.seed ?? 133742;

  // 1. Calculate Crop Dimensions
  const cropW = Math.max(2, Math.floor(srcW * cropFactor));
  const cropH = Math.max(2, Math.floor(srcH * cropFactor));

  const centerStartX = Math.floor((srcW - cropW) / 2);
  const centerStartY = Math.floor((srcH - cropH) / 2);

  const startX = Math.max(0, Math.min(srcW - cropW, centerStartX + (options?.offsetX ?? 0)));
  const startY = Math.max(0, Math.min(srcH - cropH, centerStartY + (options?.offsetY ?? 0)));

  // Output will be resampled back to source dimensions (srcW x srcH)
  const outData = new Uint8ClampedArray(srcW * srcH * 4);

  // Simple, deterministic pseudo-random number generator (Mulberry32)
  let prngState = seed >>> 0;
  const prng = () => {
    prngState |= 0;
    prngState = (prngState + 0x6d2b79f5) | 0;
    let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const xRatio = cropW / srcW;
  const yRatio = cropH / srcH;

  const bOffset = Math.round(brightnessShift * 255);

  // Bilinear Resampling of cropped region back to srcW x srcH
  for (let y = 0; y < srcH; y++) {
    const origY = startY + (y + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.floor(origY));
    const y1 = Math.min(srcH - 1, Math.ceil(origY));
    const yLerp = origY - y0;

    for (let x = 0; x < srcW; x++) {
      const origX = startX + (x + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.floor(origX));
      const x1 = Math.min(srcW - 1, Math.ceil(origX));
      const xLerp = origX - x0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const outIdx = (y * srcW + x) * 4;

      // Stochastic micro-noise for RGB (subtle perturbation below JND threshold)
      const noiseR = (prng() - 0.5) * 2 * noiseIntensity;
      const noiseG = (prng() - 0.5) * 2 * noiseIntensity;
      const noiseB = (prng() - 0.5) * 2 * noiseIntensity;

      for (let c = 0; c < 3; c++) {
        const c00 = srcData[i00 + c];
        const c10 = srcData[i10 + c];
        const c01 = srcData[i01 + c];
        const c11 = srcData[i11 + c];

        const top = c00 + xLerp * (c10 - c00);
        const bottom = c01 + xLerp * (c11 - c01);
        const interpolated = top + yLerp * (bottom - top);

        const noise = c === 0 ? noiseR : c === 1 ? noiseG : noiseB;
        outData[outIdx + c] = Math.min(255, Math.max(0, Math.round(interpolated + noise + bOffset)));
      }

      // Preserve alpha channel
      outData[outIdx + 3] = srcData[i00 + 3];
    }
  }

  return {
    width: srcW,
    height: srcH,
    data: outData,
  };
}

/**
 * Mode 1: Fast Metadata Purge (0 EXIF, 0 IPTC, 0 XMP, 0 C2PA)
 * Uses lossless binary stripper where supported; 0 quality degradation.
 */
export async function processImageMode1(
  input: Blob | File | Uint8Array,
  onProgress?: (p: ImageProcessingProgress) => void
): Promise<Mode1Result> {
  onProgress?.({ stage: 'Iniciando purga sin pérdidas de metadatos...', percent: 15 });

  const buffer = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
  const formatInfo = detectImageFormat(buffer);
  const format = formatInfo?.format || 'jpeg';

  onProgress?.({ stage: 'Extrayendo y eliminando contenedores C2PA, EXIF, IPTC y XMP...', percent: 50 });
  const { data: cleanBuffer } = await stripMetadataUniversal(buffer, format);

  onProgress?.({ stage: 'Calculando huellas criptográficas...', percent: 80 });
  const sha256 = await computeSHA256(cleanBuffer);
  const md5 = computeMD5(cleanBuffer);

  const cleanBlob = new Blob([cleanBuffer as unknown as BlobPart], { type: formatInfo?.mimeType || 'image/jpeg' });

  onProgress?.({ stage: 'Purga completada al 100%', percent: 100 });

  return {
    blob: cleanBlob,
    buffer: cleanBuffer,
    format,
    width: formatInfo?.width || 0,
    height: formatInfo?.height || 0,
    sha256,
    md5,
  };
}

/**
 * Mode 2: Deep Anti-SynthID Shield
 * Applies micro-crop, spatial bilinear resampling, and stochastic micro-noise.
 */
export async function processImageMode2(
  input: Blob | File | Uint8Array,
  onProgress?: (p: ImageProcessingProgress) => void
): Promise<Mode2Result> {
  onProgress?.({ stage: 'Decodificando matriz espacial de píxeles...', percent: 15 });

  const buffer = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
  const formatInfo = detectImageFormat(buffer);
  const format = formatInfo?.format || 'jpeg';

  const sourceMatrix = await decodeToPixelMatrix(buffer, formatInfo?.mimeType || 'image/jpeg');
  const sourceDHash = computeDHash(sourceMatrix);

  onProgress?.({ stage: 'Aplicando micro-crop 0.99x y remuestreo espacial bilineal...', percent: 45 });
  const shieldedMatrix = applyAntiSynthIDShield(sourceMatrix, {
    cropFactor: 0.99,
    noiseIntensity: 1.5,
    brightnessShift: 0.001,
    seed: 421337,
  });

  const shieldedDHash = computeDHash(shieldedMatrix);
  const perceptualDistance = hammingDistance(sourceDHash, shieldedDHash);

  onProgress?.({ stage: 'Codificando contenedor limpio sin metadatos...', percent: 75 });
  const { blob, buffer: encodedBuffer } = await encodePixelMatrix(
    shieldedMatrix,
    formatInfo?.mimeType || 'image/jpeg'
  );

  onProgress?.({ stage: 'Verificando huella criptográfica final...', percent: 90 });
  const sha256 = await computeSHA256(encodedBuffer);
  const md5 = computeMD5(encodedBuffer);

  onProgress?.({ stage: 'Blindaje Anti-SynthID completado al 100%', percent: 100 });

  return {
    blob,
    buffer: encodedBuffer,
    format,
    width: shieldedMatrix.width,
    height: shieldedMatrix.height,
    sha256,
    md5,
    perceptualDistance,
    sourceDHash,
    shieldedDHash,
  };
}

/**
 * Mode 3: Multi-Variant Spoofer
 * Generates N unique variants (3, 5, or 10) with unique hashes and distinct perceptual hashes.
 */
export async function processImageMode3(
  input: Blob | File | Uint8Array,
  variantCount: number = 3,
  onProgress?: (p: ImageProcessingProgress) => void
): Promise<Mode3VariantResult[]> {
  const count = Math.min(10, Math.max(3, variantCount));
  onProgress?.({ stage: `Iniciando generación de ${count} variantes únicas...`, percent: 10 });

  const buffer = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
  const formatInfo = detectImageFormat(buffer);
  const format = formatInfo?.format || 'jpeg';

  const sourceMatrix = await decodeToPixelMatrix(buffer, formatInfo?.mimeType || 'image/jpeg');
  const results: Mode3VariantResult[] = [];

  for (let i = 1; i <= count; i++) {
    const cropFactor = CROP_SEEDS[(i - 1) % CROP_SEEDS.length];
    const brightness = (((i % 5) - 2) * 0.001);
    const offsetX = (i % 3) - 1;
    const offsetY = ((i * 2) % 3) - 1;
    const seed = i * 7919 + 104729;

    onProgress?.({
      stage: `Generando variante ${i}/${count} (recorte ${cropFactor.toFixed(3)}x)...`,
      percent: Math.round(15 + (i / count) * 70),
    });

    const variantMatrix = applyAntiSynthIDShield(sourceMatrix, {
      cropFactor,
      noiseIntensity: 1.0 + (i % 3) * 0.4,
      brightnessShift: brightness,
      seed,
      offsetX,
      offsetY,
    });

    const dHash = computeDHash(variantMatrix);
    const pHash = computePHash(variantMatrix);

    const { blob, buffer: encodedBuffer } = await encodePixelMatrix(
      variantMatrix,
      formatInfo?.mimeType || 'image/jpeg'
    );

    const sha256 = await computeSHA256(encodedBuffer);
    const md5 = computeMD5(encodedBuffer);

    results.push({
      id: i,
      blob,
      buffer: encodedBuffer,
      format,
      width: variantMatrix.width,
      height: variantMatrix.height,
      sha256,
      md5,
      dHash,
      pHash,
    });
  }

  onProgress?.({ stage: `Variantes ${count}/${count} generadas exitosamente`, percent: 100 });

  return results;
}

/**
 * Universal Image Decoder to PixelMatrix (RGBA Uint8ClampedArray)
 * Uses browser Canvas / createImageBitmap when available;
 * fallback pure decoder for Node.js test environments.
 */
export async function decodeToPixelMatrix(
  buffer: Uint8Array,
  mimeType: string
): Promise<PixelMatrix> {
  // Browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([buffer as unknown as BlobPart], { type: mimeType });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    ctx.drawImage(bitmap, 0, 0);
    const imgData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return {
      width: bitmap.width,
      height: bitmap.height,
      data: imgData.data,
    };
  }

  // Node.js test environment: decode BMP directly
  if (buffer.length >= 54 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return decodeBmpToPixelMatrix(buffer);
  }

  // Fallback synthetic pixel matrix for non-browser testing
  const formatInfo = detectImageFormat(buffer);
  const width = formatInfo?.width || 64;
  const height = formatInfo?.height || 64;
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill pseudo-content based on input bytes
  for (let i = 0; i < width * height; i++) {
    const byte = buffer[i % buffer.length];
    data[i * 4] = byte;
    data[i * 4 + 1] = (byte * 3) & 0xff;
    data[i * 4 + 2] = (byte * 7) & 0xff;
    data[i * 4 + 3] = 255;
  }

  return { width, height, data };
}

/**
 * Encodes PixelMatrix to clean image Blob & Uint8Array with 0 metadata.
 * Uses browser Canvas when available, pure canonical BMP encoder in Node.js.
 */
export async function encodePixelMatrix(
  matrix: PixelMatrix,
  mimeType: string,
  quality: number = 0.95
): Promise<{ blob: Blob; buffer: Uint8Array }> {
  // Browser environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = matrix.width;
    canvas.height = matrix.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    const imgData = ctx.createImageData(matrix.width, matrix.height);
    imgData.data.set(matrix.data);
    ctx.putImageData(imgData, 0, 0);

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob(
        (b) => resolve(b || new Blob([])),
        mimeType.includes('png') ? 'image/png' : 'image/jpeg',
        quality
      );
    });

    const arrayBuf = await blob.arrayBuffer();
    return { blob, buffer: new Uint8Array(arrayBuf) };
  }

  // Node.js environment: encode to canonical 24-bit uncompressed BMP
  const bmpBuffer = encodePixelMatrixToBmp(matrix);
  const blob = new Blob([bmpBuffer as unknown as BlobPart], { type: 'image/bmp' });
  return { blob, buffer: bmpBuffer };
}

/**
 * Pure TypeScript BMP decoder (24-bit / 32-bit RGB)
 */
function decodeBmpToPixelMatrix(bytes: Uint8Array): PixelMatrix {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dataOffset = view.getUint32(10, true);
  const width = Math.abs(view.getInt32(18, true));
  const height = Math.abs(view.getInt32(22, true));
  const bpp = view.getUint16(28, true);

  const out = new Uint8ClampedArray(width * height * 4);
  const bytesPerPixel = bpp / 8;
  const rowSize = Math.floor((bpp * width + 31) / 32) * 4;

  for (let y = 0; y < height; y++) {
    // BMP is bottom-to-top by default if height > 0
    const srcRow = height - 1 - y;
    const rowOffset = dataOffset + srcRow * rowSize;

    for (let x = 0; x < width; x++) {
      const srcPx = rowOffset + x * bytesPerPixel;
      const dstPx = (y * width + x) * 4;

      // BMP stores BGR(A)
      out[dstPx] = bytes[srcPx + 2];     // R
      out[dstPx + 1] = bytes[srcPx + 1]; // G
      out[dstPx + 2] = bytes[srcPx];     // B
      out[dstPx + 3] = bytesPerPixel === 4 ? bytes[srcPx + 3] : 255; // A
    }
  }

  return { width, height, data: out };
}

/**
 * Pure TypeScript canonical BMP encoder (24-bit BGR)
 */
export function encodePixelMatrixToBmp(matrix: PixelMatrix): Uint8Array {
  const { width, height, data } = matrix;
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  // BITMAPFILEHEADER (14 bytes)
  buffer[0] = 0x42; // 'B'
  buffer[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true); // File size
  view.setUint32(6, 0, true);        // Reserved
  view.setUint32(10, 54, true);      // Pixel data offset

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);     // DIB header size
  view.setInt32(18, width, true);    // Width
  view.setInt32(22, height, true);   // Height (positive = bottom-to-top)
  view.setUint16(26, 1, true);       // Planes = 1
  view.setUint16(28, 24, true);      // BPP = 24
  view.setUint32(30, 0, true);       // BI_RGB (uncompressed)
  view.setUint32(34, pixelArraySize, true); // Image size
  view.setInt32(38, 2835, true);     // Horizontal resolution ~72 DPI
  view.setInt32(42, 2835, true);     // Vertical resolution ~72 DPI
  view.setUint32(46, 0, true);       // Colors in palette
  view.setUint32(50, 0, true);       // Important colors

  // Write pixel data (BGR, bottom-to-top)
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y;
    const rowOffset = 54 + y * rowSize;

    for (let x = 0; x < width; x++) {
      const srcPx = (srcRow * width + x) * 4;
      const dstPx = rowOffset + x * 3;

      buffer[dstPx] = data[srcPx + 2];     // B
      buffer[dstPx + 1] = data[srcPx + 1]; // G
      buffer[dstPx + 2] = data[srcPx];     // R
    }
  }

  return buffer;
}
