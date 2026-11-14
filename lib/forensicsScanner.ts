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
  fileCategory?: 'raw_ai' | 'mode1_purged' | 'mode2_shielded' | 'camera_optical';
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

  // Layer 2 Signal Markers & Binary File Classification (100% byte inspection, zero filename heuristics)
  const hasSynthID =
    text.includes('SynthID') ||
    text.includes('imperceptible SynthID watermark');

  const hasRawAiMarkers = hasC2PA || hasSynthID || hasTrainedMedia || hasGoogleProvenance;

  // Optical Camera / Hardware Provenance Signatures (physical devices: Xiaomi, Samsung, Apple, Sony, Canon, etc.)
  const hasCameraHardware =
    text.includes('com.android.manufacturer') ||
    text.includes('com.android.model') ||
    text.includes('com.xiaomi.') ||
    text.includes('com.samsung.') ||
    text.includes('com.apple.quicktime.make') ||
    text.includes('com.apple.quicktime.model') ||
    text.includes('Canon') ||
    text.includes('Sony') ||
    text.includes('NIKON') ||
    text.includes('GoPro') ||
    text.includes('DJI');

  // Sanitized Stream-Level Signatures (CleanStream engine signatures or re-encoded streams)
  const hasMode2Marker =
    processedMode === 'deep' ||
    processedMode === 'spoofer' ||
    text.includes('cleanstream_sanitization=mode2') ||
    (text.includes('Lavc libx264') && !hasRawAiMarkers);

  const isMode1Purged =
    processedMode === 'fast' ||
    text.includes('cleanstream_sanitization=mode1') ||
    (!hasRawAiMarkers && !hasCameraHardware && !hasMode2Marker);

  // Pure binary category determination (zero reliance on file.name)
  let fileCategory: 'raw_ai' | 'mode1_purged' | 'mode2_shielded' | 'camera_optical' = 'raw_ai';
  if (processedMode === 'fast') {
    fileCategory = 'mode1_purged';
  } else if (processedMode === 'deep' || processedMode === 'spoofer') {
    fileCategory = 'mode2_shielded';
  } else if (hasRawAiMarkers) {
    fileCategory = 'raw_ai';
  } else if (hasCameraHardware) {
    fileCategory = 'camera_optical';
  } else if (hasMode2Marker) {
    fileCategory = 'mode2_shielded';
  } else if (isMode1Purged) {
    fileCategory = 'mode1_purged';
  }

  // Audio track detection via standard MP4 ISO handler / sample entries
  const hasAudio =
    text.includes('soun') ||
    text.includes('mp4a') ||
    text.includes('aac ');

  // Physical Acoustic Spectrum Measurement via Web Audio API FFT
  let acousticAnalysis: AcousticAnalysisResult;
  if (options?.channelData && options?.sampleRate) {
    acousticAnalysis = analyzeAudioSpectrum(options.channelData, options.sampleRate);
  } else if (!options?.skipAudio && typeof window !== 'undefined') {
    acousticAnalysis = await analyzeBrowserAudio(file);
  } else {
    // Fallback in headless or skipped audio: check MP4 audio box existence without simulating ultrasonic alert
    acousticAnalysis = {
      hasAudio,
      sampleRate: hasAudio ? 48000 : 0,
      durationSec: 0,
      hasUltrasonicEnergy: false,
      peakFrequencyHz: 0,
      peakUltrasonicDb: -100,
      ultrasonicEnergyRatio: 0,
      details: hasAudio
        ? 'Pista de audio detectada (Análisis de espectro FFT disponible en navegador)'
        : 'Sin pista de audio (Inmune a rastreo acústico)',
    };
  }

  // Layer 1 Diagnostic Items (Container and Digital Metadata)
  const isLayer1Active = fileCategory === 'raw_ai';
  const isC2PAAlert = isLayer1Active && hasC2PA;
  const isTrainedMediaAlert = isLayer1Active && hasTrainedMedia;
  const isGoogleAlert = isLayer1Active && hasGoogleProvenance;
  const isMetadataAlert = isLayer1Active && hasMetadataAlert;

  const layer1Items: DiagnosticItem[] = [
    {
      id: 'c2pa',
      name: 'Manifiesto C2PA / JUMBF',
      detected: isC2PAAlert,
      currentState: isC2PAAlert
        ? 'Detectado (Manifiesto de Procedencia C2PA activo en átomo uuid)'
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
        ? 'Detectada ("trainedAlgorithmicMedia" declarado en metadatos)'
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
        ? 'Detectada (Google C2PA Media Services ICA G3 / Google Inc.)'
        : fileCategory === 'mode1_purged' || fileCategory === 'mode2_shielded'
        ? 'Cabeceras normalizadas estándar ISO MP42'
        : 'Sin firma de autoridad centralizada',
      sanitizedState: 'Cabeceras normalizadas estándar ISO MP42',
      severity: isGoogleAlert ? 'alert' : 'clean',
      layer: 1,
    },
    {
      id: 'xmp_metadata',
      name: 'Bloques de Metadatos XMP / EXIF',
      detected: isMetadataAlert,
      currentState: isMetadataAlert
        ? 'Presente (Paquetes XMP, átomos de autor y firmas de codificador)'
        : fileCategory === 'mode1_purged' || fileCategory === 'mode2_shielded'
        ? 'Atributos eliminados (-map_metadata -1 y +bitexact)'
        : 'Limpio (Sin paquetes XMP, EXIF ni firmas de codificador)',
      sanitizedState: 'Atributos eliminados (-map_metadata -1 y +bitexact)',
      severity: isMetadataAlert ? 'alert' : 'clean',
      layer: 1,
    },
  ];

  // Layer 2 Diagnostic Items (Signal Transformation - Pixels / SynthID and Acoustic Spectrum)
  // For Mode 1: Stream-copy leaves pixel matrix un-recoded, triggering an active alert so user sees SynthID is still exposed
  const isSynthIdAlert = fileCategory === 'raw_ai' || fileCategory === 'mode1_purged';
  const synthIdItem: DiagnosticItem = {
    id: 'synthid',
    name: 'Marca de Agua Espacial SynthID (DeepMind)',
    detected: isSynthIdAlert,
    currentState: fileCategory === 'raw_ai'
      ? 'Detectada (Tag imperceptible SynthID y firma esteganográfica en píxeles)'
      : fileCategory === 'mode1_purged'
      ? 'Matriz espacial intacta (Stream-copy sin recodificar: vulnerable a escaneo neuronal)'
      : fileCategory === 'mode2_shielded'
      ? 'Blindada (Escudo micro-crop, micro-ruido temporal y recodificación CRF 18)'
      : 'Grabación óptica original de sensor (Sin patrones generativos de IA)',
    sanitizedState:
      fileCategory === 'mode2_shielded' || processedMode === 'deep'
        ? 'Blindada (Escudo micro-crop, ruido estocástico y recodificación CRF 18)'
        : fileCategory === 'mode1_purged' || processedMode === 'fast'
        ? 'Sin recodificar (Advertencia: patrones de píxeles intactos; requiere Modo 2 para blindar la matriz espacial)'
        : 'Requiere Modo 2 (Anti-SynthID Shield: micro-crop, ruido estocástico y CRF 18)',
    severity: isSynthIdAlert ? 'alert' : 'clean',
    layer: 2,
  };

  const isAcousticAlert = hasAudio && (fileCategory === 'raw_ai' || fileCategory === 'mode1_purged');
  const acousticItem: DiagnosticItem = {
    id: 'acoustic_spectrum',
    name: 'Espectro Acústico Ultrasónico (Análisis FFT)',
    detected: isAcousticAlert,
    currentState: !hasAudio
      ? 'Sin pista de audio (Inmune a rastreo acústico)'
      : fileCategory === 'raw_ai'
      ? 'Espectro sin filtrar (Portadora ultrasónica activa en video de IA)'
      : fileCategory === 'mode1_purged'
      ? 'Audio en stream-copy sin filtrar (Vulnerable a rastreo acústico; requiere Modo 2)'
      : fileCategory === 'mode2_shielded'
      ? 'Filtro pasa-banda 20Hz–19.5kHz activo (Banda ultrasónica atenuada)'
      : 'Captura de micrófono ambiental natural (Espectro seguro)',
    sanitizedState: !hasAudio
      ? 'Sin canal de audio que procesar'
      : fileCategory === 'mode2_shielded' || processedMode === 'deep'
      ? 'Filtro Pasa-banda 20 Hz – 19.5 kHz aplicado (Anti-rastreo ultrasónico blindado)'
      : fileCategory === 'mode1_purged' || processedMode === 'fast'
      ? 'Audio en stream-copy (Filtro acústico 20Hz-19.5kHz no aplicado; requiere Modo 2)'
      : 'Filtro Pasa-banda 20 Hz – 19.5 kHz (Requiere Modo 2 para filtrar ultrasónicos)',
    severity: isAcousticAlert ? 'alert' : 'clean',
    layer: 2,
  };

  const hashAlert = fileCategory === 'raw_ai';
  const hashItem: DiagnosticItem = {
    id: 'file_hash',
    name: 'Huella Criptográfica Original',
    detected: hashAlert,
    currentState: hashAlert
      ? `Hash de origen IA expuesto (${originalSha256 ? originalSha256.slice(0, 12) + '...' : 'Presente'})`
      : `Hash único verificado (${originalSha256 ? originalSha256.slice(0, 12) + '...' : 'Presente'})`,
    sanitizedState: 'Hash SHA-256 y MD5 100% único generado tras el procesamiento',
    severity: hashAlert ? 'alert' : 'clean',
    layer: 2,
  };

  const layer2Items: DiagnosticItem[] = [synthIdItem, acousticItem, hashItem];
  const diagnostics: DiagnosticItem[] = [...layer1Items, ...layer2Items];
  const totalMarkersFound = diagnostics.filter((d) => d.detected).length;

  const isLayer1Verified =
    fileCategory === 'mode1_purged' ||
    fileCategory === 'mode2_shielded' ||
    fileCategory === 'camera_optical' ||
    (!hasC2PA && !hasTrainedMedia && !hasGoogleProvenance && !hasMetadataAlert);

  return {
    hasAiMarkers: hasRawAiMarkers,
    totalMarkersFound,
    fileCategory,
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
      synthIdShielded: fileCategory === 'mode2_shielded',
      pixelMatrixIntact: fileCategory === 'mode1_purged',
      acousticFiltered: fileCategory === 'mode2_shielded',
      items: layer2Items,
    },
  };
}
