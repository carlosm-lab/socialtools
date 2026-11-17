/**
 * CleanStream Studio — Universal Batch Processing Engine
 * Orchestrates multi-file forensic auditing, parallel image stripping,
 * sequential WebAssembly video sanitization, and ZIP archiving.
 */

import { ForensicsReport } from './forensicsScanner';
import { scanImageForensics } from './imageForensicsScanner';
import { scanVideoForensics } from './forensicsScanner';
import { processImageMode1, processImageMode2, processImageMode3 } from './imageEngine';
import { computeSHA256, computeMD5 } from './cryptoUtils';
import JSZip from 'jszip';
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export interface BatchItem {
  id: string;
  file: File;
  mediaType: 'image' | 'video';
  format: string;
  sizeBytes: number;
  sizeFormatted: string;
  status: 'pending' | 'scanning' | 'ready' | 'processing' | 'done' | 'error';
  progress: number;
  stageMessage: string;
  forensicsReport: ForensicsReport | null;
  resultBlob: Blob | null;
  resultBuffer: Uint8Array | null;
  resultUrl: string | null;
  resultFileName: string | null;
  sha256?: string;
  md5?: string;
  error?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isImageFile(file: File): boolean {
  return (
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|avif|heic|heif|tiff?|bmp)$/i.test(file.name)
  );
}

export function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith('video/') ||
    /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(file.name)
  );
}

export async function auditBatchItem(item: BatchItem): Promise<ForensicsReport> {
  if (item.mediaType === 'image') {
    return await scanImageForensics(item.file);
  } else {
    return await scanVideoForensics(item.file, { skipAudio: true });
  }
}

/**
 * Processes an image item with Mode 1 or Mode 2.
 */
export async function processBatchImage(
  item: BatchItem,
  mode: 'fast' | 'deep' | 'spoofer',
  onProgress?: (percent: number, stage: string) => void
): Promise<{
  blob: Blob;
  buffer: Uint8Array;
  fileName: string;
  sha256: string;
  md5: string;
  postScan: ForensicsReport;
}> {
  onProgress?.(20, 'Purgando metadatos de imagen...');
  let resultBuffer: Uint8Array;
  let resultBlob: Blob;
  let sha256: string;
  let md5: string;

  if (mode === 'fast') {
    const res = await processImageMode1(item.file, (p) => {
      onProgress?.(p.percent, p.stage);
    });
    resultBuffer = res.buffer;
    resultBlob = res.blob;
    sha256 = res.sha256;
    md5 = res.md5;
  } else if (mode === 'deep') {
    const res = await processImageMode2(item.file, (p) => {
      onProgress?.(p.percent, p.stage);
    });
    resultBuffer = res.buffer;
    resultBlob = res.blob;
    sha256 = res.sha256;
    md5 = res.md5;
  } else {
    const res = await processImageMode3(item.file, 3, (p) => {
      onProgress?.(p.percent, p.stage);
    });
    const first = res[0] || await processImageMode2(item.file);
    resultBuffer = first.buffer;
    resultBlob = first.blob;
    sha256 = first.sha256;
    md5 = first.md5;
  }

  onProgress?.(90, 'Verificando contenedor purgado...');
  const postScan = await scanImageForensics(resultBuffer, { processedMode: mode });

  const ext = item.file.name.includes('.') ? item.file.name.slice(item.file.name.lastIndexOf('.')) : '.png';
  const baseName = item.file.name.replace(/\.[^/.]+$/, '');
  const cleanFileName = `clean_${baseName}${ext}`;

  onProgress?.(100, 'Limpieza completada');
  return {
    blob: resultBlob,
    buffer: resultBuffer,
    fileName: cleanFileName,
    sha256,
    md5,
    postScan,
  };
}

/**
 * Processes a video item via loaded FFmpeg instance with Mode 1, Mode 2, or Mode 3.
 */
export async function processBatchVideo(
  ffmpeg: FFmpeg,
  item: BatchItem,
  mode: 'fast' | 'deep' | 'spoofer',
  onProgress?: (percent: number, stage: string) => void
): Promise<{
  blob: Blob;
  buffer: Uint8Array;
  fileName: string;
  sha256: string;
  md5: string;
  postScan: ForensicsReport;
}> {
  onProgress?.(10, 'Cargando archivo de video al motor local...');

  // Cleanup virtual files before run
  const vFiles = ['batch_input.mp4', 'batch_output.mp4'];
  for (const f of vFiles) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore */ }
  }

  const fileData = await fetchFile(item.file);
  await ffmpeg.writeFile('batch_input.mp4', fileData);

  if (mode === 'fast') {
    onProgress?.(35, 'Purgando manifiesto C2PA y metadatos de video...');
    const exitCode = await ffmpeg.exec([
      '-i', 'batch_input.mp4',
      '-map', '0:v:0',
      '-map', '0:a?',
      '-map_metadata', '-1',
      '-map_metadata:s', '-1',
      '-c:v', 'copy',
      '-c:a', 'copy',
      '-bsf:v', 'filter_units=remove_types=6',
      '-dn',
      '-fflags', '+bitexact',
      '-flags:v', '+bitexact',
      '-flags:a', '+bitexact',
      '-metadata:s:v:0', 'encoder=',
      '-metadata:s:a:0', 'encoder=',
      '-metadata', 'cleanstream_sanitization=mode1_c2pa_purged',
      'batch_output.mp4',
    ]);
    if (exitCode !== 0) throw new Error(`FFmpeg finalizó con código de error ${exitCode}`);
  } else {
    onProgress?.(35, 'Aplicando blindaje espacial y espectral Anti-SynthID...');
    const exitCode = await ffmpeg.exec([
      '-i', 'batch_input.mp4',
      '-map', '0:v:0',
      '-map', '0:a?',
      '-vf', 'crop=in_w*0.99:in_h*0.99,scale=in_w:in_h:flags=bilinear,noise=c0s=1.5:allf=t+u',
      '-af', 'lowpass=f=19500,highpass=f=20',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'veryfast',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-map_metadata', '-1',
      '-map_metadata:s', '-1',
      '-fflags', '+bitexact',
      '-flags:v', '+bitexact',
      '-flags:a', '+bitexact',
      '-metadata:s:v:0', 'encoder=',
      '-metadata:s:a:0', 'encoder=',
      '-metadata', 'cleanstream_sanitization=mode2_shielded',
      'batch_output.mp4',
    ]);
    if (exitCode !== 0) throw new Error(`FFmpeg finalizó con código de error ${exitCode}`);
  }

  onProgress?.(85, 'Extrayendo video purgado...');
  const rawData = await ffmpeg.readFile('batch_output.mp4');
  const buffer = rawData instanceof Uint8Array ? rawData : new TextEncoder().encode(String(rawData));

  const sha256 = await computeSHA256(buffer);
  const md5 = computeMD5(buffer);
  const blob = new Blob([buffer.slice() as unknown as BlobPart], { type: 'video/mp4' });

  // Cleanup virtual files after read
  for (const f of vFiles) {
    try { await ffmpeg.deleteFile(f); } catch { /* ignore */ }
  }

  const cleanFile = new File([blob], `clean_${item.file.name}`, { type: 'video/mp4' });
  const postScan = await scanVideoForensics(cleanFile, { processedMode: mode, skipAudio: true });

  onProgress?.(100, 'Video purgado al 100%');
  return {
    blob,
    buffer,
    fileName: `clean_${item.file.name}`,
    sha256,
    md5,
    postScan,
  };
}

/**
 * Bundles all completed batch items into a single downloadable .ZIP archive.
 */
export async function generateBatchZip(items: BatchItem[]): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('archivos_limpiados') || zip;

  let addedCount = 0;
  for (const item of items) {
    if (item.status === 'done' && (item.resultBuffer || item.resultBlob)) {
      const fileName = item.resultFileName || `clean_${item.file.name}`;
      if (item.resultBuffer) {
        folder.file(fileName, item.resultBuffer);
        addedCount++;
      } else if (item.resultBlob) {
        const arr = await item.resultBlob.arrayBuffer();
        folder.file(fileName, arr);
        addedCount++;
      }
    }
  }

  if (addedCount === 0) {
    throw new Error('No hay archivos procesados para generar el ZIP.');
  }

  return await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
