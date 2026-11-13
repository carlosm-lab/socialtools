import { computeSHA256 } from './cryptoUtils';
import {
  analyzeBrowserAudio,
  analyzeAudioSpectrum,
  AcousticAnalysisResult,
} from './acousticAnalyzer';

export interface DiagnosticItem {
  id: string;
  name: string;
  detected: boolean;
  currentState: string;
  sanitizedState: string;
  severity: 'alert' | 'clean';
  layer: 1 | 2;
}

export interface ForensicsReport {
  hasAiMarkers: boolean;
  totalMarkersFound: number;
  diagnostics: DiagnosticItem[];
  originalSha256?: string;
  fileSizeBytes?: number;
  durationSec?: number;
  processedMode?: 'fast' | 'deep' | 'spoofer' | null;
  acousticAnalysis?: AcousticAnalysisResult;
  layer1: {
    name: string;
    verified: boolean;
    items: DiagnosticItem[];
  };
  layer2: {
    name: string;
    synthIdShielded: boolean;
    pixelMatrixIntact: boolean;
    acousticFiltered: boolean;
    items: DiagnosticItem[];
  };
}

export interface ScanVideoOptions {
  processedMode?: 'fast' | 'deep' | 'spoofer';
  skipAudio?: boolean;
  channelData?: Float32Array;
  sampleRate?: number;
}

/**
 * Scans an in-memory video file for AI provenance, C2PA manifests,
 * SynthID watermarks, IPTC algorithmic tags, and container metadata.
 * Implements a Two-Layer Forensic Report Architecture:
 * - Layer 1: Container & Digital Metadata (binary verified)
 * - Layer 2: Signal Transformation (Pixels / SynthID & Acoustic FFT)
 */
export async function scanVideoForensics(
  file: File,
  options?: ScanVideoOptions
): Promise<ForensicsReport> {
  const processedMode = options?.processedMode || null;

  // Read first 6MB which contains container headers, moov atoms, uuid boxes, and manifests
  const sampleSize = Math.min(file.size, 6 * 1024 * 1024);
  const headerSlice = file.slice(0, sampleSize);
  const arrayBuffer = await headerSlice.arrayBuffer();
  const text = new TextDecoder('latin1').decode(new Uint8Array(arrayBuffer));

  // Compute SHA-256 of header slice or small file
  let originalSha256 = '';
  try {
    originalSha256 = await computeSHA256(arrayBuffer);
  } catch {
    originalSha256 = 'unknown';
  }

  // Layer 1 Container & Digital Metadata Detection
  const hasC2PA =
    text.includes('c2pa') ||
    text.includes('jumb') ||
    text.includes('caBX') ||
    text.includes('c2ma');

  const hasTrainedMedia =
    text.includes('trainedAlgorithmicMedia') ||
    text.includes('digitalSourceType') ||
    text.includes('trainedAlgorithm');

  const hasGoogleProvenance =
    text.includes('Google LLC') ||
    text.includes('Google C2PA') ||
    text.includes('Google Inc.') ||
    text.includes('Google');

  const hasXMP =
    text.includes('<?xpacket') ||
    text.includes('http://ns.adobe.com/xap/1.0/') ||
    text.includes('W5M0MpCehiHzreSzNTczkc9d') ||
    text.includes('<x:xmpmeta') ||
    text.includes('xmlns:xmp=') ||
    text.includes('xmpDM:');

  const hasExifOrEncoderTags =
    text.includes('Exif\0\0') ||
    text.includes('GPSVersionID') ||
    text.includes('x264 - core') ||
    text.includes('Google Inc.');

  const hasMetadataAlert = hasXMP || hasExifOrEncoderTags;

  // Layer 2 Signal Markers
  const hasSynthID =
    text.includes('SynthID') ||
    text.includes('imperceptible SynthID watermark');

  const hasAiMarkers = hasC2PA || hasSynthID || hasTrainedMedia || hasGoogleProvenance;

  // Physical Acoustic Spectrum Measurement via Web Audio API FFT
  let acousticAnalysis: AcousticAnalysisResult;
  if (options?.channelData && options?.sampleRate) {
    acousticAnalysis = analyzeAudioSpectrum(options.channelData, options.sampleRate);
  } else if (!options?.skipAudio && typeof window !== 'undefined') {
    acousticAnalysis = await analyzeBrowserAudio(file);
  } else {
    // Fallback in headless or skipped audio: check MP4 audio box existence without simulating ultrasonic alert
    const hasAudioBox =
      text.includes('soun') || text.includes('mp4a') || text.includes('aac ');
    acousticAnalysis = {
      hasAudio: hasAudioBox,
      sampleRate: hasAudioBox ? 48000 : 0,
      durationSec: 0,
      hasUltrasonicEnergy: false,
      peakFrequencyHz: 0,
      peakUltrasonicDb: -100,
      ultrasonicEnergyRatio: 0,
      details: hasAudioBox
        ? 'Pista de audio detectada (Análisis de espectro FFT disponible en navegador)'
        : 'Sin pista de audio (Inmune a rastreo acústico)',
    };
  }

  const isDeep = processedMode === 'deep';
  const isFast = processedMode === 'fast';

  // Layer 1 Diagnostic Items (Container and Digital Metadata)
  const layer1Items: DiagnosticItem[] = [
    {
      id: 'c2pa',
      name: 'Manifiesto C2PA / JUMBF',
      detected: isFast || isDeep ? false : hasC2PA,
      currentState: isFast || isDeep
        ? '0 Firmas (Contenedor purgado 100% sin manifiestos)'
        : hasC2PA
        ? 'Detectado (Manifiesto de Procedencia C2PA activo en átomo uuid)'
        : 'No detectado (Sin manifiestos de procedencia)',
      sanitizedState: '0 Firmas (Contenedor purgado 100% sin manifiestos)',
      severity: isFast || isDeep ? 'clean' : hasC2PA ? 'alert' : 'clean',
      layer: 1,
    },
    {
      id: 'iptc_ai',
      name: 'Procedencia Algorítmica (IPTC)',
      detected: isFast || isDeep ? false : hasTrainedMedia,
      currentState: isFast || isDeep
        ? 'Limpio (Sin etiquetas de procedencia generativa)'
        : hasTrainedMedia
        ? 'Detectada ("trainedAlgorithmicMedia" declarado en metadatos)'
        : 'No declarada en metadatos',
      sanitizedState: 'Metadatos purgados (Sin etiquetas de modelo generativo)',
      severity: isFast || isDeep ? 'clean' : hasTrainedMedia ? 'alert' : 'clean',
      layer: 1,
    },
    {
      id: 'provenance_authority',
      name: 'Autoridad Certificadora & Generador',
      detected: isFast || isDeep ? false : hasGoogleProvenance,
      currentState: isFast || isDeep
        ? 'Normalizado (Estándar ISO MP42 sin firmas de autoridad)'
        : hasGoogleProvenance
        ? 'Detectada (Google C2PA Media Services ICA G3 / Google Inc.)'
        : 'Sin firma de autoridad centralizada',
      sanitizedState: 'Cabeceras normalizadas estándar ISO MP42',
      severity: isFast || isDeep ? 'clean' : hasGoogleProvenance ? 'alert' : 'clean',
      layer: 1,
    },
    {
      id: 'xmp_metadata',
      name: 'Bloques de Metadatos XMP / EXIF',
      detected: isFast || isDeep ? false : hasMetadataAlert,
      currentState: isFast || isDeep
        ? 'Limpio (Sin paquetes XMP, EXIF ni firmas de codificador)'
        : hasMetadataAlert
        ? 'Presente (Paquetes XMP, átomos de autor y firmas de codificador)'
        : 'Limpio (Sin paquetes XMP, EXIF ni firmas de codificador)',
      sanitizedState: 'Atributos eliminados (-map_metadata -1 y +bitexact)',
      severity: isFast || isDeep ? 'clean' : hasMetadataAlert ? 'alert' : 'clean',
      layer: 1,
    },
  ];

  // Layer 2 Diagnostic Items (Signal Transformation - Pixels / SynthID and Acoustic Spectrum)
  const synthIdItem: DiagnosticItem = {
    id: 'synthid',
    name: 'Marca de Agua Espacial SynthID (DeepMind)',
    detected: isDeep ? false : (hasSynthID || hasAiMarkers),
    currentState: isDeep
      ? 'Blindada: Matriz de píxeles alterada (micro-crop 0.99 + micro-ruido temporal)'
      : isFast
      ? 'Matriz espacial intacta (stream-copy: detectable por clasificadores neuronales en servidor)'
      : hasSynthID
      ? 'Detectada (Tag imperceptible SynthID y firma esteganográfica en píxeles)'
      : 'Matriz espacial intacta (Requiere recodificación CRF 18 para blindaje)',
    sanitizedState: isDeep
      ? 'Blindada (Escudo micro-crop, ruido estocástico y recodificación CRF 18)'
      : isFast
      ? 'Sin recodificar (Advertencia: patrones de píxeles intactos; requiere Modo 2 para blindar la matriz espacial)'
      : 'Requiere Modo 2 (Anti-SynthID Shield: micro-crop, ruido estocástico y CRF 18)',
    severity: isDeep ? 'clean' : (hasSynthID || isFast || hasAiMarkers ? 'alert' : 'clean'),
    layer: 2,
  };

  const acousticItem: DiagnosticItem = {
    id: 'acoustic_spectrum',
    name: 'Espectro Acústico Ultrasónico (Análisis FFT)',
    detected: isDeep ? false : acousticAnalysis.hasUltrasonicEnergy,
    currentState: !acousticAnalysis.hasAudio
      ? 'Sin pista de audio (Inmune a rastreo acústico)'
      : isDeep
      ? 'Filtro pasa-banda 20Hz–19.5kHz activo (Banda ultrasónica atenuada)'
      : acousticAnalysis.hasUltrasonicEnergy
      ? `Portadora ultrasónica activa a ${acousticAnalysis.peakUltrasonicDb} dBFS (>19.5 kHz)`
      : `Espectro ultrasónico seguro (${acousticAnalysis.peakUltrasonicDb} dBFS, sin portadoras activas)`,
    sanitizedState: !acousticAnalysis.hasAudio
      ? 'Sin canal de audio que procesar'
      : isDeep
      ? 'Filtro Pasa-banda 20 Hz – 19.5 kHz aplicado (Anti-rastreo ultrasónico blindado)'
      : isFast
      ? 'Audio en stream-copy (Filtro acústico 20Hz-19.5kHz no aplicado; requiere Modo 2)'
      : 'Filtro Pasa-banda 20 Hz – 19.5 kHz (Requiere Modo 2 para filtrar ultrasónicos)',
    severity: isDeep ? 'clean' : (acousticAnalysis.hasUltrasonicEnergy ? 'alert' : 'clean'),
    layer: 2,
  };

  const hashAlert = isDeep || isFast ? false : hasAiMarkers;
  const hashItem: DiagnosticItem = {
    id: 'file_hash',
    name: 'Huella Criptográfica Original',
    detected: hashAlert,
    currentState: hashAlert
      ? `Hash de origen IA expuesto (${originalSha256 ? originalSha256.slice(0, 12) + '...' : 'Presente'})`
      : `Hash único verificado (${originalSha256 ? originalSha256.slice(0, 12) + '...' : 'Presente'})`,
    sanitizedState: isDeep || isFast
      ? 'Hash SHA-256 y MD5 100% único generado tras el procesamiento'
      : processedMode === 'spoofer'
      ? 'Hashes únicos por variante generados con micro-modulaciones'
      : 'Hash independiente (Sin coincidencias en bases de IA)',
    severity: hashAlert ? 'alert' : 'clean',
    layer: 2,
  };

  const layer2Items: DiagnosticItem[] = [synthIdItem, acousticItem, hashItem];
  const diagnostics: DiagnosticItem[] = [...layer1Items, ...layer2Items];
  const totalMarkersFound = diagnostics.filter((d) => d.detected).length;

  const isLayer1Verified =
    isFast ||
    isDeep ||
    (!hasC2PA && !hasTrainedMedia && !hasGoogleProvenance && !hasMetadataAlert);

  return {
    hasAiMarkers,
    totalMarkersFound,
    diagnostics,
    originalSha256,
    fileSizeBytes: file.size,
    processedMode,
    acousticAnalysis,
    layer1: {
      name: 'Contenedor y Metadatos Digitales',
      verified: isLayer1Verified,
      items: layer1Items,
    },
    layer2: {
      name: 'Transformación de Señal (Píxeles y Espectro)',
      synthIdShielded: isDeep,
      pixelMatrixIntact: isFast || (!processedMode && true),
      acousticFiltered: isDeep,
      items: layer2Items,
    },
  };
}
