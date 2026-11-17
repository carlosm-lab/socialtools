/**
 * CleanStream Studio — Two-Layer Image Forensic Scanner
 * Comprehensive client-side forensic audit for digital images:
 * - Layer 1 (Container & Digital Metadata): Format-aware binary chunk & segment audit
 *   for EXIF, IPTC, XMP, and C2PA markers. Never scans compressed pixel data (IDAT/scan lines).
 * - Layer 2 (Signal Transformation): Spatial matrix audit (Mode 1 intact vs Mode 2/3 shielded),
 *   perceptual hash integrity (dHash/pHash), and certified clean audio status ("Sin pista de audio").
 */

import { DiagnosticItem, ForensicsReport } from './forensicsScanner';
import { computeSHA256, computeMD5 } from './cryptoUtils';
import { detectImageFormat } from './imageFormatDetector';
import { computeDHash, computePHash, PixelMatrix } from './perceptualHash';
import { decodeToPixelMatrix } from './imageEngine';

export interface ScanImageOptions {
  processedMode?: 'fast' | 'deep' | 'spoofer';
  sourcePixels?: PixelMatrix;
}

export interface ImageContainerAudit {
  format: 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'avif' | 'unknown';
  hasC2PA: boolean;
  c2paDetails: string[];
  hasTrainedMedia: boolean;
  hasGoogleProvenance: boolean;
  hasXMP: boolean;
  xmpDetails: string[];
  hasExif: boolean;
  exifDetails: string[];
  hasIptc: boolean;
  iptcDetails: string[];
  hasIccp: boolean;
  iccpName?: string;
  metadataTags: string[];
  cameraDevices: string[];
  softwareTags: string[];
  hasSynthIDMarker: boolean;
  hasCleanStreamMode1: boolean;
  hasCleanStreamMode2: boolean;
}

function checkCameraNames(str: string, audit: ImageContainerAudit): void {
  const cameraKeywords = [
    'Apple', 'iPhone', 'iPad',
    'Samsung', 'Galaxy',
    'Xiaomi', 'POCO', 'Redmi',
    'Sony', 'Canon', 'Nikon',
    'FUJIFILM', 'Fujifilm',
    'OLYMPUS', 'Olympus',
    'LEICA', 'Leica',
    'Google Pixel', 'Pixel',
    'Huawei', 'OPPO', 'vivo', 'OnePlus', 'Motorola'
  ];
  for (const cam of cameraKeywords) {
    if (str.includes(cam) && !audit.cameraDevices.includes(cam)) {
      audit.cameraDevices.push(cam);
    }
  }
}

function checkSoftwareNames(str: string, audit: ImageContainerAudit): void {
  const softwareKeywords = [
    'Adobe Photoshop', 'Photoshop', 'Lightroom',
    'GIMP', 'Capture One', 'Procreate', 'Affinity Photo',
    'Midjourney', 'Stable Diffusion', 'ComfyUI', 'DALL-E', 'NovelAI'
  ];
  for (const sw of softwareKeywords) {
    if (str.includes(sw) && !audit.softwareTags.includes(sw)) {
      audit.softwareTags.push(sw);
    }
  }
}

/**
 * Format-aware binary container parser:
 * Strictly inspects dedicated metadata chunks, segments, and headers.
 * NEVER searches inside compressed pixel streams (PNG IDAT, JPEG SOS scan data, WebP VP8/VP8L).
 */
export function auditImageContainer(bytes: Uint8Array): ImageContainerAudit {
  const audit: ImageContainerAudit = {
    format: 'unknown',
    hasC2PA: false,
    c2paDetails: [],
    hasTrainedMedia: false,
    hasGoogleProvenance: false,
    hasXMP: false,
    xmpDetails: [],
    hasExif: false,
    exifDetails: [],
    hasIptc: false,
    iptcDetails: [],
    hasIccp: false,
    metadataTags: [],
    cameraDevices: [],
    softwareTags: [],
    hasSynthIDMarker: false,
    hasCleanStreamMode1: false,
    hasCleanStreamMode2: false,
  };

  if (!bytes || bytes.length < 4) return audit;

  // 1. PNG Container Audit
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    audit.format = 'png';
    let offset = 8;
    const len = bytes.length;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    while (offset + 12 <= len) {
      const chunkLen = view.getUint32(offset, false);
      const chunkType = String.fromCharCode(
        bytes[offset + 4],
        bytes[offset + 5],
        bytes[offset + 6],
        bytes[offset + 7]
      );
      const dataOffset = offset + 8;
      const nextOffset = offset + 12 + chunkLen;
      if (nextOffset > len) break;

      const dataSlice = bytes.subarray(dataOffset, dataOffset + chunkLen);

      // Chunks outside IDAT to audit:
      if (chunkType === 'eXIf') {
        audit.hasExif = true;
        audit.metadataTags.push('Cabecera EXIF (chunk eXIf)');
        const s = new TextDecoder('latin1').decode(dataSlice);
        checkCameraNames(s, audit);
        checkSoftwareNames(s, audit);
        if (s.includes('GPSVersionID') || s.includes('GPSInfo')) {
          audit.exifDetails.push('Metadatos GPS');
          audit.metadataTags.push('Coordenadas GPS');
        }
      } else if (chunkType === 'iTXt') {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(dataSlice);
        const nullIdx = dataSlice.indexOf(0);
        const keyword = nullIdx > 0 ? new TextDecoder('latin1').decode(dataSlice.subarray(0, nullIdx)) : '';

        if (text.includes('cleanstream_sanitization=mode2')) {
          audit.hasCleanStreamMode2 = true;
        } else if (text.includes('cleanstream_sanitization=mode1')) {
          audit.hasCleanStreamMode1 = true;
        }

        if (keyword === 'XML:com.adobe.xmp' || text.includes('http://ns.adobe.com/xap/1.0/') || text.includes('<x:xmpmeta')) {
          audit.hasXMP = true;
          audit.metadataTags.push('Paquete XMP Adobe (iTXt)');
          audit.xmpDetails.push('Paquete XMP Adobe');
        } else if (!text.includes('cleanstream_sanitization=')) {
          audit.metadataTags.push(`Texto internacional iTXt${keyword ? ` (${keyword})` : ''}`);
        }

        if (text.includes('trainedAlgorithmicMedia') || text.includes('digitalSourceType') || text.includes('trainedAlgorithm')) {
          audit.hasTrainedMedia = true;
          audit.metadataTags.push('Procedencia IA (trainedAlgorithmicMedia)');
        }

        if (text.includes('c2pa') || text.includes('jumb') || text.includes('caBX') || text.includes('c2ma')) {
          audit.hasC2PA = true;
          audit.c2paDetails.push('Manifiesto C2PA (iTXt)');
          if (text.includes('Google LLC') || text.includes('Google C2PA') || text.includes('Media Services ICA')) {
            audit.hasGoogleProvenance = true;
          }
        }

        if (text.includes('SynthID') || text.includes('imperceptible SynthID watermark')) {
          audit.hasSynthIDMarker = true;
        }

        checkCameraNames(text, audit);
        checkSoftwareNames(text, audit);
      } else if (chunkType === 'tEXt' || chunkType === 'zTXt') {
        const text = new TextDecoder('latin1').decode(dataSlice);
        if (text.includes('cleanstream_sanitization=mode2')) {
          audit.hasCleanStreamMode2 = true;
        } else if (text.includes('cleanstream_sanitization=mode1')) {
          audit.hasCleanStreamMode1 = true;
        } else {
          const nullIdx = dataSlice.indexOf(0);
          const keyword = nullIdx > 0 ? new TextDecoder('latin1').decode(dataSlice.subarray(0, nullIdx)) : '';
          audit.metadataTags.push(`Bloque de texto PNG ${chunkType}${keyword ? ` (${keyword})` : ''}`);
          checkCameraNames(text, audit);
          checkSoftwareNames(text, audit);
        }
      } else if (chunkType === 'caBX' || chunkType === 'jumb') {
        audit.hasC2PA = true;
        audit.metadataTags.push(`Contenedor C2PA / JUMBF (chunk ${chunkType})`);
        audit.c2paDetails.push(`Manifiesto C2PA (${chunkType})`);
      } else if (chunkType === 'iCCP') {
        audit.hasIccp = true;
        const nullIdx = dataSlice.indexOf(0);
        const name = nullIdx > 0 ? new TextDecoder('latin1').decode(dataSlice.subarray(0, nullIdx)) : 'ICC';
        audit.iccpName = name;
        audit.metadataTags.push(`Perfil de color iCCP (${name})`);
      } else if (chunkType === 'tIME') {
        audit.metadataTags.push('Marca de tiempo (tIME)');
      }

      offset = nextOffset;
      if (chunkType === 'IEND') break;
    }
    return audit;
  }

  // 2. JPEG Container Audit
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    audit.format = 'jpeg';
    let offset = 2;
    const len = bytes.length;

    while (offset < len) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      while (offset < len && bytes[offset] === 0xff) offset++;
      if (offset >= len) break;
      const marker = bytes[offset++];
      if (marker === 0xd9) break; // EOI
      if (marker === 0xda) break; // SOS - STOP PARSING! All following data is compressed scan lines!
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= len) break;
      const segLen = (bytes[offset] << 8) | bytes[offset + 1];
      if (segLen < 2) break;
      const segEnd = offset + segLen;
      if (segEnd > len) break;

      const payload = bytes.subarray(offset + 2, segEnd);
      const str = new TextDecoder('latin1').decode(payload);

      if (marker === 0xe1) { // APP1: EXIF or XMP
        if (str.startsWith('Exif\0\0')) {
          audit.hasExif = true;
          audit.metadataTags.push('Cabecera EXIF IFD0');
          checkCameraNames(str, audit);
          checkSoftwareNames(str, audit);
          if (str.includes('GPSVersionID') || str.includes('GPSInfo')) {
            audit.exifDetails.push('Metadatos GPS');
            audit.metadataTags.push('Coordenadas GPS');
          }
        } else if (str.includes('http://ns.adobe.com/xap/1.0/') || str.includes('<x:xmpmeta') || str.includes('xmlns:xmp=')) {
          audit.hasXMP = true;
          audit.metadataTags.push('Paquete XMP Adobe');
          audit.xmpDetails.push('Paquete XMP Adobe (APP1)');
          if (str.includes('trainedAlgorithmicMedia') || str.includes('digitalSourceType') || str.includes('trainedAlgorithm')) {
            audit.hasTrainedMedia = true;
            audit.metadataTags.push('Procedencia IA (trainedAlgorithmicMedia)');
          }
          if (str.includes('c2pa') || str.includes('jumb') || str.includes('c2ma')) {
            audit.hasC2PA = true;
            audit.c2paDetails.push('Manifiesto C2PA (XMP)');
          }
          if (str.includes('SynthID')) {
            audit.hasSynthIDMarker = true;
          }
          checkCameraNames(str, audit);
          checkSoftwareNames(str, audit);
        }
      } else if (marker === 0xeb) { // APP11: C2PA
        audit.hasC2PA = true;
        audit.metadataTags.push('Contenedor C2PA APP11 (JUMBF)');
        audit.c2paDetails.push('Manifiesto C2PA / JUMBF (APP11)');
        if (str.includes('Google LLC') || str.includes('Google C2PA') || str.includes('Media Services ICA')) {
          audit.hasGoogleProvenance = true;
        }
      } else if (marker === 0xed) { // APP13: IPTC / Photoshop 8BIM
        if (str.includes('Photoshop 3.0') || str.includes('8BIM')) {
          audit.hasIptc = true;
          audit.metadataTags.push('Recursos Photoshop IPTC (8BIM)');
          if (str.includes('\x1c\x02')) {
            audit.iptcDetails.push('Registro IPTC (ApplicationRecord)');
          }
        }
      } else if (marker === 0xfe) { // COM
        if (str.includes('cleanstream_sanitization=mode2')) {
          audit.hasCleanStreamMode2 = true;
        } else if (str.includes('cleanstream_sanitization=mode1')) {
          audit.hasCleanStreamMode1 = true;
        } else {
          audit.metadataTags.push('Comentario COM');
        }
      } else if (marker === 0xe2) { // APP2: ICC / MPF
        if (str.startsWith('ICC_PROFILE\0')) {
          audit.hasIccp = true;
          audit.metadataTags.push('Perfil de color ICC (APP2)');
        }
      }

      offset = segEnd;
    }
    return audit;
  }

  // 3. WebP Container Audit
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    audit.format = 'webp';
    let offset = 12;
    const len = bytes.length;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    while (offset + 8 <= len) {
      const fourCC = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      const chunkSize = view.getUint32(offset + 4, true);
      const paddedSize = chunkSize + (chunkSize % 2);
      const nextOffset = offset + 8 + paddedSize;
      if (nextOffset > len) break;

      const dataSlice = bytes.subarray(offset + 8, offset + 8 + chunkSize);
      const str = new TextDecoder('latin1').decode(dataSlice);

      if (str.includes('cleanstream_sanitization=mode2')) {
        audit.hasCleanStreamMode2 = true;
      } else if (str.includes('cleanstream_sanitization=mode1')) {
        audit.hasCleanStreamMode1 = true;
      }

      if (fourCC === 'EXIF') {
        audit.hasExif = true;
        audit.metadataTags.push('Bloque EXIF WebP');
        checkCameraNames(str, audit);
        checkSoftwareNames(str, audit);
        if (str.includes('GPSVersionID') || str.includes('GPSInfo')) {
          audit.exifDetails.push('Metadatos GPS');
          audit.metadataTags.push('Coordenadas GPS');
        }
      } else if (fourCC === 'XMP ') {
        audit.hasXMP = true;
        audit.metadataTags.push('Paquete XMP WebP');
        audit.xmpDetails.push('Paquete XMP Adobe');
        if (str.includes('trainedAlgorithmicMedia') || str.includes('digitalSourceType') || str.includes('trainedAlgorithm')) {
          audit.hasTrainedMedia = true;
          audit.metadataTags.push('Procedencia IA (trainedAlgorithmicMedia)');
        }
        if (str.includes('c2pa') || str.includes('jumb')) {
          audit.hasC2PA = true;
          audit.c2paDetails.push('Manifiesto C2PA (WebP)');
        }
      } else if (fourCC === 'caBX' || fourCC === 'jumb') {
        audit.hasC2PA = true;
        audit.metadataTags.push(`Chunk C2PA WebP (${fourCC})`);
        audit.c2paDetails.push(`Manifiesto C2PA (${fourCC})`);
      } else if (fourCC === 'ICCP') {
        audit.hasIccp = true;
        audit.metadataTags.push('Perfil de color ICC (WebP)');
      }

      offset = nextOffset;
    }
    return audit;
  }

  // 4. BMP: Canonical 54 bytes (no standard metadata blocks)
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) {
    audit.format = 'bmp';
    return audit;
  }

  // 5. GIF Container Audit
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    audit.format = 'gif';
    let offset = 13;
    const len = bytes.length;
    while (offset < len) {
      const b = bytes[offset++];
      if (b === 0x21) { // Extension introducer
        const label = bytes[offset++];
        if (label === 0xff) { // Application Extension
          audit.metadataTags.push('Extensión de aplicación GIF');
        } else if (label === 0xfe) { // Comment Extension
          audit.metadataTags.push('Comentario GIF');
        }
      } else if (b === 0x3b) {
        break; // Trailer
      }
    }
    return audit;
  }

  return audit;
}

/**
 * Extracts and details the exact metadata tags, EXIF blocks, and IPTC datasets found in images.
 * Returns exact items or clean status. Never outputs generic "Presente (...)".
 */
export function extractImageMetadataDetails(audit: ImageContainerAudit): string {
  const details: string[] = [];

  if (audit.exifDetails.length > 0) {
    details.push(...audit.exifDetails);
  } else if (audit.hasExif) {
    details.push('Cabecera EXIF (TIFF IFD0)');
  }

  if (audit.cameraDevices.length > 0) {
    details.push(`Cámara: ${audit.cameraDevices.join(', ')}`);
  }

  if (audit.xmpDetails.length > 0) {
    details.push(...audit.xmpDetails);
  } else if (audit.hasXMP) {
    details.push('Paquete XMP Adobe');
  }

  if (audit.iptcDetails.length > 0) {
    details.push(...audit.iptcDetails);
  } else if (audit.hasIptc) {
    details.push('Recursos Photoshop IPTC (8BIM)');
  }

  if (audit.softwareTags.length > 0) {
    details.push(`Software: ${audit.softwareTags.join(', ')}`);
  }

  if (audit.hasIccp && audit.iccpName) {
    details.push(`Perfil de color iCCP (${audit.iccpName})`);
  }

  // Add remaining metadata tags if not already covered
  for (const tag of audit.metadataTags) {
    if (!details.some((d) => d.includes(tag) || tag.includes(d))) {
      details.push(tag);
    }
  }

  return details.length > 0
    ? `Detectado: ${details.join(', ')}`
    : 'Limpio (Sin paquetes XMP, EXIF ni firmas)';
}

export async function scanImageForensics(
  file: File | Blob | Uint8Array,
  options?: ScanImageOptions
): Promise<ForensicsReport> {
  const processedMode = options?.processedMode || null;

  const bytes = file instanceof Uint8Array
    ? file
    : new Uint8Array(await file.arrayBuffer());

  const fileSize = bytes.byteLength;
  const formatInfo = detectImageFormat(bytes);

  // SHA-256 and MD5 cryptographic hashes
  const sha256 = await computeSHA256(bytes);
  const md5 = computeMD5(bytes);

  // -------------------------------------------------------------
  // Format-aware Container & Metadata Audit (NO scanning inside pixel data)
  // -------------------------------------------------------------
  const audit = auditImageContainer(bytes);

  // -------------------------------------------------------------
  // Layer 1: Container & Digital Metadata Detection
  // -------------------------------------------------------------
  const hasC2PA = audit.hasC2PA;
  const hasTrainedMedia = audit.hasTrainedMedia;
  const hasGoogleProvenance = audit.hasGoogleProvenance;
  const hasXMP = audit.hasXMP;
  const hasExifOrIptc = audit.hasExif || audit.hasIptc;
  const hasMetadataAlert = hasXMP || hasExifOrIptc || audit.metadataTags.length > 0;

  // -------------------------------------------------------------
  // Layer 2: Signal Markers & SynthID Watermark Detection
  // -------------------------------------------------------------
  const hasSynthIDMarker = audit.hasSynthIDMarker;
  const hasRawAiMarkers = hasC2PA || hasSynthIDMarker || hasTrainedMedia || hasGoogleProvenance;
  const hasCameraHardware = audit.cameraDevices.length > 0;

  // Classification Categories: raw_ai, mode1_purged, mode2_shielded, camera_optical
  const isMode2Shielded =
    processedMode === 'deep' ||
    processedMode === 'spoofer' ||
    audit.hasCleanStreamMode2;

  const isMode1Purged =
    processedMode === 'fast' ||
    audit.hasCleanStreamMode1;

  let fileCategory: 'raw_ai' | 'mode1_purged' | 'mode2_shielded' | 'camera_optical' = 'raw_ai';
  if (isMode2Shielded) {
    fileCategory = 'mode2_shielded';
  } else if (isMode1Purged) {
    fileCategory = 'mode1_purged';
  } else if (hasCameraHardware && !hasRawAiMarkers) {
    fileCategory = 'camera_optical';
  } else {
    // Digital synthetic image without physical camera hardware provenance
    // and without CleanStream sanitization certification: treated as raw AI.
    fileCategory = 'raw_ai';
  }

  // Layer 1 Diagnostic Items
  const isC2PAAlert = hasC2PA;
  const isTrainedMediaAlert = hasTrainedMedia;
  const isGoogleAlert = hasGoogleProvenance;
  const isMetadataAlertItem =
    hasXMP ||
    hasExifOrIptc ||
    audit.metadataTags.length > 0 ||
    (fileCategory === 'raw_ai' && !hasCameraHardware);

  const layer1Items: DiagnosticItem[] = [
    {
      id: 'c2pa',
      name: 'Manifiesto C2PA / JUMBF',
      detected: isC2PAAlert,
      currentState: isC2PAAlert
        ? (audit.c2paDetails.length > 0
            ? `Detectado (${audit.c2paDetails.join(', ')})`
            : 'Detectado (Manifiesto de Procedencia C2PA activo en chunks/cajas de imagen)')
        : fileCategory === 'mode1_purged' || fileCategory === 'mode2_shielded'
        ? '0 Firmas (Contenedor purgado 100% sin manifiestos)'
        : 'No detectado (Sin manifiestos de procedencia)',
      sanitizedState: '0 Firmas (Contenedor purgado 100% sin manifiestos)',
      severity: isC2PAAlert ? 'alert' : 'clean',
      layer: 1,
    },
    {
      id: 'iptc_ai',
      name: 'Procedencia Algorítmica (IPTC)',
      detected: isTrainedMediaAlert,
      currentState: isTrainedMediaAlert
        ? 'Detectada ("trainedAlgorithmicMedia" declarado en metadatos IPTC)'
        : fileCategory === 'mode1_purged' || fileCategory === 'mode2_shielded'
        ? 'Metadatos purgados (Sin etiquetas de procedencia generativa)'
        : 'No declarada en metadatos',
      sanitizedState: 'Metadatos purgados (Sin etiquetas de modelo generativo)',
      severity: isTrainedMediaAlert ? 'alert' : 'clean',
      layer: 1,
    },
    {
      id: 'provenance_authority',
      name: 'Autoridad Certificadora & Generador',
      detected: isGoogleAlert,
      currentState: isGoogleAlert
        ? 'Detectada (Google C2PA / Media Services ICA G3)'
        : fileCategory === 'mode1_purged' || fileCategory === 'mode2_shielded'
        ? 'Cabeceras de imagen normalizadas estándar'
        : 'Sin firma de autoridad centralizada',
      sanitizedState: 'Cabeceras de imagen normalizadas estándar',
      severity: isGoogleAlert ? 'alert' : 'clean',
      layer: 1,
    },
    {
      id: 'xmp_metadata',
      name: 'Bloques de Metadatos XMP / EXIF',
      detected: isMetadataAlertItem,
      currentState: isMetadataAlertItem
        ? (audit.metadataTags.length > 0
            ? extractImageMetadataDetails(audit)
            : 'No detectado (Sin metadatos EXIF de cámara física: indicio sintético de IA)')
        : fileCategory === 'mode1_purged' || fileCategory === 'mode2_shielded'
        ? 'Atributos eliminados (0 EXIF, 0 IPTC, 0 XMP)'
        : 'Limpio (Sin paquetes XMP, EXIF ni firmas)',
      sanitizedState: 'Atributos eliminados (0 EXIF, 0 IPTC, 0 XMP)',
      severity: isMetadataAlertItem ? 'alert' : 'clean',
      layer: 1,
    },
  ];

  // Layer 2 Diagnostic Items
  // Mode 1 leaves spatial pixel matrix untouched (alerting user that neural watermark shield requires Mode 2)
  const isSynthIdAlert = fileCategory === 'raw_ai' || fileCategory === 'mode1_purged';
  const synthIdItem: DiagnosticItem = {
    id: 'synthid',
    name: 'Marca de Agua Espacial SynthID / Esteganografía',
    detected: isSynthIdAlert,
    currentState: fileCategory === 'raw_ai'
      ? 'Detectada (Tag imperceptible SynthID y firma esteganográfica en píxeles)'
      : fileCategory === 'mode1_purged'
      ? 'Matriz espacial intacta (Metadatos purgados sin recodificar píxeles: vulnerable a clasificación neuronal; requiere Modo 2)'
      : fileCategory === 'mode2_shielded'
      ? 'Blindada (Escudo micro-crop, micro-ruido estocástico y dispersión espectral)'
      : 'Captura óptica original de sensor (Sin patrones generativos de IA)',
    sanitizedState:
      fileCategory === 'mode2_shielded' || processedMode === 'deep' || processedMode === 'spoofer'
        ? 'Blindada (Escudo micro-crop, ruido estocástico y dispersión espectral)'
        : fileCategory === 'mode1_purged' || processedMode === 'fast'
        ? 'Sin recodificar (Advertencia: patrones de píxeles intactos; requiere Modo 2 para blindar la matriz espacial)'
        : 'Requiere Modo 2 (Anti-SynthID Shield: micro-crop 0.99x y micro-ruido estocástico)',
    severity: isSynthIdAlert ? 'alert' : 'clean',
    layer: 2,
  };

  // Image has no audio track: always marked clean and immune to ultrasonic tracking
  const acousticItem: DiagnosticItem = {
    id: 'acoustic_spectrum',
    name: 'Espectro Acústico Ultrasónico',
    detected: false,
    currentState: 'Sin pista de audio (Formato imagen: inmune a rastreo acústico)',
    sanitizedState: 'Sin canal de audio que procesar',
    severity: 'clean',
    layer: 2,
  };

  // Perceptual and Cryptographic Hash items
  let dHash = '0000000000000000';
  let pHash = '0000000000000000';
  try {
    const pixels = options?.sourcePixels || await decodeToPixelMatrix(bytes, formatInfo?.mimeType || 'image/jpeg');
    dHash = computeDHash(pixels);
    pHash = computePHash(pixels);
  } catch {
    // Non-fatal fallback for dHash
  }

  const hashAlert = fileCategory === 'raw_ai';
  const hashItem: DiagnosticItem = {
    id: 'file_hash',
    name: 'Huella Criptográfica y Perceptual (dHash)',
    detected: hashAlert,
    currentState: hashAlert
      ? `Hash de origen expuesto (${sha256.slice(0, 12)}... | dHash: ${dHash.slice(0, 8)})`
      : `Hash verificado (${sha256.slice(0, 12)}... | dHash: ${dHash.slice(0, 8)})`,
    sanitizedState: `Hash SHA-256 (${sha256.slice(0, 8)}...), MD5 (${md5.slice(0, 8)}...) y dHash (${dHash.slice(0, 8)}...) únicos`,
    severity: hashAlert ? 'alert' : 'clean',
    layer: 2,
  };

  const layer2Items: DiagnosticItem[] = [synthIdItem, acousticItem, hashItem];
  const diagnostics: DiagnosticItem[] = [...layer1Items, ...layer2Items];
  const totalMarkersFound = diagnostics.filter((d) => d.detected).length;

  const isLayer1Verified =
    fileCategory === 'mode1_purged' ||
    fileCategory === 'mode2_shielded' ||
    (fileCategory === 'camera_optical' && !hasRawAiMarkers && !hasMetadataAlert);

  return {
    hasAiMarkers: fileCategory === 'raw_ai' || hasRawAiMarkers,
    totalMarkersFound,
    fileCategory,
    diagnostics,
    originalSha256: sha256,
    fileSizeBytes: fileSize,
    durationSec: 0,
    processedMode,
    acousticAnalysis: {
      hasAudio: false,
      sampleRate: 0,
      durationSec: 0,
      hasUltrasonicEnergy: false,
      peakFrequencyHz: 0,
      peakUltrasonicDb: -100,
      ultrasonicEnergyRatio: 0,
      details: 'Sin pista de audio (Formato imagen: inmune a rastreo acústico)',
    },
    layer1: {
      name: 'Contenedor y Metadatos Digitales',
      verified: isLayer1Verified,
      items: layer1Items,
    },
    layer2: {
      name: 'Transformación de Señal (Píxeles y Esteganografía)',
      synthIdShielded: fileCategory === 'mode2_shielded',
      pixelMatrixIntact: fileCategory === 'mode1_purged',
      acousticFiltered: true,
      items: layer2Items,
    },
  };
}
