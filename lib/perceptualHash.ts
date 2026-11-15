/**
 * CleanStream Studio — Client-Side Perceptual Hash Engine
 * Implements high-performance perceptual hashing algorithms (dHash, aHash, pHash)
 * and Hamming distance computation on downsampled grayscale matrices.
 * Operates on pure typed arrays: works in browser Canvas / ImageData and Node.js.
 */

export interface PixelMatrix {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array; // RGBA sequence
}

/**
 * Converts a 64-element binary bit array [0, 1, ...] to a 16-hex character string.
 */
function bitsToHex(bits: number[]): string {
  let hex = '';
  for (let i = 0; i < 64; i += 4) {
    const nybble =
      ((bits[i] || 0) << 3) |
      ((bits[i + 1] || 0) << 2) |
      ((bits[i + 2] || 0) << 1) |
      (bits[i + 3] || 0);
    hex += nybble.toString(16);
  }
  return hex.padStart(16, '0');
}

/**
 * Computes dHash (Difference / Gradient Hash)
 * Resizes to 9x8 grayscale, compares adjacent horizontal pixels.
 * Produces a 64-bit hash (16 hexadecimal characters).
 */
export function computeDHash(image: PixelMatrix): string {
  const gray = downsampleGrayscale(image, 9, 8);
  const bits: number[] = [];

  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = gray[y * 9 + x];
      const right = gray[y * 9 + (x + 1)];
      bits.push(left > right ? 1 : 0);
    }
  }

  return bitsToHex(bits);
}

/**
 * Computes aHash (Average Hash)
 * Resizes to 8x8 grayscale, compares each pixel to mean luminance.
 * Produces a 64-bit hash (16 hexadecimal characters).
 */
export function computeAHash(image: PixelMatrix): string {
  const gray = downsampleGrayscale(image, 8, 8);
  let sum = 0;
  for (let i = 0; i < 64; i++) {
    sum += gray[i];
  }
  const mean = sum / 64;

  const bits: number[] = [];
  for (let i = 0; i < 64; i++) {
    bits.push(gray[i] >= mean ? 1 : 0);
  }

  return bitsToHex(bits);
}

/**
 * Computes pHash (Discrete Cosine Transform Perceptual Hash)
 * Resizes to 32x32 grayscale, computes 2D DCT, extracts top-left 8x8 coefficients
 * (excluding DC [0,0]), compares to median.
 * Produces a 64-bit hash (16 hexadecimal characters).
 */
export function computePHash(image: PixelMatrix): string {
  const N = 32;
  const gray = downsampleGrayscale(image, N, N);

  // Compute 2D DCT on 32x32
  const dct = new Float64Array(64); // Only need top-left 8x8
  const c = (u: number) => (u === 0 ? 1 / Math.sqrt(2) : 1);

  for (let u = 0; u < 8; u++) {
    for (let v = 0; v < 8; v++) {
      let sum = 0;
      for (let x = 0; x < N; x++) {
        const cosX = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
        for (let y = 0; y < N; y++) {
          const cosY = Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
          sum += gray[y * N + x] * cosX * cosY;
        }
      }
      dct[u * 8 + v] = 0.25 * c(u) * c(v) * sum;
    }
  }

  // Calculate median of 64 coefficients (excluding DC at [0,0])
  const subDct = Array.from(dct.subarray(1)); // 63 AC coefficients
  subDct.sort((a, b) => a - b);
  const median = subDct[Math.floor(subDct.length / 2)];

  const bits: number[] = [];
  for (let i = 0; i < 64; i++) {
    bits.push(dct[i] > median ? 1 : 0);
  }

  return bitsToHex(bits);
}

/**
 * Computes Hamming Distance (number of differing bits) between two 64-bit hex hashes.
 */
export function hammingDistance(hexHash1: string, hexHash2: string): number {
  let dist = 0;
  const h1 = hexHash1.padStart(16, '0');
  const h2 = hexHash2.padStart(16, '0');
  const len = Math.max(h1.length, h2.length);

  for (let i = 0; i < len; i++) {
    const v1 = parseInt(h1[i] || '0', 16);
    const v2 = parseInt(h2[i] || '0', 16);
    let xor = v1 ^ v2;
    while (xor > 0) {
      dist += xor & 1;
      xor >>= 1;
    }
  }

  return dist;
}

/**
 * Bilinear downsampler and grayscale converter from RGBA buffer.
 * Luminance = 0.299*R + 0.587*G + 0.114*B
 */
export function downsampleGrayscale(
  image: PixelMatrix,
  targetW: number,
  targetH: number
): Float32Array {
  const { width: srcW, height: srcH, data } = image;
  const result = new Float32Array(targetW * targetH);

  const xRatio = srcW / targetW;
  const yRatio = srcH / targetH;

  for (let y = 0; y < targetH; y++) {
    const srcY = (y + 0.5) * yRatio - 0.5;
    const y0 = Math.max(0, Math.floor(srcY));
    const y1 = Math.min(srcH - 1, Math.ceil(srcY));
    const yLerp = srcY - y0;

    for (let x = 0; x < targetW; x++) {
      const srcX = (x + 0.5) * xRatio - 0.5;
      const x0 = Math.max(0, Math.floor(srcX));
      const x1 = Math.min(srcW - 1, Math.ceil(srcX));
      const xLerp = srcX - x0;

      // Sample 4 neighbor pixels (RGBA)
      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      const lum00 = 0.299 * data[i00] + 0.587 * data[i00 + 1] + 0.114 * data[i00 + 2];
      const lum10 = 0.299 * data[i10] + 0.587 * data[i10 + 1] + 0.114 * data[i10 + 2];
      const lum01 = 0.299 * data[i01] + 0.587 * data[i01 + 1] + 0.114 * data[i01 + 2];
      const lum11 = 0.299 * data[i11] + 0.587 * data[i11 + 1] + 0.114 * data[i11 + 2];

      const top = lum00 + xLerp * (lum10 - lum00);
      const bottom = lum01 + xLerp * (lum11 - lum01);
      result[y * targetW + x] = top + yLerp * (bottom - top);
    }
  }

  return result;
}
