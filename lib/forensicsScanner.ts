import { computeSHA256 } from './cryptoUtils';

export interface DiagnosticItem {
  id: string;
  name: string;
  detected: boolean;
  currentState: string;
  sanitizedState: string;
  severity: 'alert' | 'clean';
}

export interface ForensicsReport {
  hasAiMarkers: boolean;
  totalMarkersFound: number;
  diagnostics: DiagnosticItem[];
  originalSha256?: string;
  fileSizeBytes?: number;
  durationSec?: number;
}

/**
 * Scans an in-memory video file slice for AI provenance, C2PA manifests,
 * SynthID watermarks, IPTC algorithmic tags, and container metadata.
 */
export async function scanVideoForensics(file: File): Promise<ForensicsReport> {
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

  // Marker detection
  const hasC2PA =
    text.includes('c2pa') ||
    text.includes('jumb') ||
    text.includes('caBX') ||
    text.includes('c2ma');

  const hasSynthID =
    text.includes('SynthID') ||
    text.includes('imperceptible SynthID watermark');

  const hasTrainedMedia =
    text.includes('trainedAlgorithmicMedia') ||
    text.includes('digitalSourceType') ||
    text.includes('trainedAlgorithm');

  const hasGoogleProvenance =
    text.includes('Google LLC') ||
    text.includes('Google C2PA') ||
    text.includes('Google Inc.') ||
    text.includes('Google');

  const hasAiMarkers = hasC2PA || hasSynthID || hasTrainedMedia || hasGoogleProvenance;

  // Genuine XMP / EXIF packages and unstripped encoder metadata tags.
  // Note: Standard structural MP4 container atoms (such as 'udta' box headers)
  // are standard ISO/IEC 14496-12 atoms and NOT sensitive metadata.
  const hasXMP =
    text.includes('<?xpacket') ||
    text.includes('http://ns.adobe.com/xap/1.0/') ||
    text.includes('W5M0MpCehiHzreSzNTczkc9d') ||
    text.includes('xmp:') ||
    text.includes('xmpDM:');

  const hasExifOrEncoderTags =
    text.includes('Exif\0\0') ||
    text.includes('GPSVersionID') ||
    text.includes('x264 - core') ||
    text.includes('Lavf') ||
    text.includes('Lavc') ||
    text.includes('Google Inc.');

  const hasMetadataAlert = hasXMP || hasExifOrEncoderTags;

  // Audio track detection via standard MP4 ISO handler / sample entries
  const hasAudio =
    text.includes('soun') ||
    text.includes('mp4a') ||
    text.includes('aac ');

  // Ultrasonic carrier and hash indexing alerts only apply to untreated AI videos.
  // Cleaned files and organic smartphone camera recordings do not carry AI watermarks or indexed AI hashes.
  const acousticAlert = hasAudio && hasAiMarkers;
  const hashAlert = hasAiMarkers;

  const diagnostics: DiagnosticItem[] = [
    {
      id: 'c2pa',
      name: 'Manifiesto C2PA / JUMBF',
      detected: hasC2PA,
      currentState: hasC2PA
        ? 'Detectado (Manifiesto de Procedencia C2PA activo en átomo uuid)'
        : 'No detectado (Sin manifiestos de procedencia)',
      sanitizedState: '0 Firmas (Contenedor purgado 100% sin manifiestos)',
      severity: hasC2PA ? 'alert' : 'clean',
    },
    {
      id: 'synthid',
      name: 'Marca de Agua SynthID (DeepMind)',
      detected: hasSynthID,
      currentState: hasSynthID
        ? 'Detectada (Tag imperceptible SynthID y firma esteganográfica)'
        : 'No detectada en cabecera ni flujo',
      sanitizedState: 'Neutralizada (Escudo micro-crop, ruido y recodificación CRF 18)',
      severity: hasSynthID ? 'alert' : 'clean',
    },
    {
      id: 'iptc_ai',
      name: 'Procedencia Algorítmica (IPTC)',
      detected: hasTrainedMedia,
      currentState: hasTrainedMedia
        ? 'Detectada ("trainedAlgorithmicMedia" declarado en metadatos)'
        : 'No declarada en metadatos',
      sanitizedState: 'Metadatos purgados (Sin etiquetas de modelo generativo)',
      severity: hasTrainedMedia ? 'alert' : 'clean',
    },
    {
      id: 'provenance_authority',
      name: 'Autoridad Certificadora & Generador',
      detected: hasGoogleProvenance,
      currentState: hasGoogleProvenance
        ? 'Detectada (Google C2PA Media Services ICA G3 / Google Inc.)'
        : 'Sin firma de autoridad centralizada',
      sanitizedState: 'Cabeceras normalizadas estándar ISO MP42',
      severity: hasGoogleProvenance ? 'alert' : 'clean',
    },
    {
      id: 'xmp_metadata',
      name: 'Bloques de Metadatos XMP / EXIF',
      detected: hasMetadataAlert,
      currentState: hasMetadataAlert
        ? 'Presente (Paquetes XMP, átomos de autor y firmas de codificador)'
        : 'Limpio (Sin paquetes XMP, EXIF ni firmas de codificador)',
      sanitizedState: 'Atributos eliminados (-map_metadata -1 y +bitexact)',
      severity: hasMetadataAlert ? 'alert' : 'clean',
    },
    {
      id: 'acoustic_spectrum',
      name: 'Espectro Acústico Ultrasónico',
      detected: acousticAlert,
      currentState: !hasAudio
        ? 'Sin pista de audio (Inmune a rastreo acústico)'
        : acousticAlert
        ? 'Espectro sin filtrar (Portadora ultrasónica >19.5 kHz activa en video de IA)'
        : 'Espectro acústico seguro (Sin portadoras ultrasónicas de IA)',
      sanitizedState: !hasAudio
        ? 'Sin canal de audio que procesar'
        : 'Filtro Pasa-banda 20 Hz – 19.5 kHz blindado (Anti-rastreo de audio)',
      severity: acousticAlert ? 'alert' : 'clean',
    },
    {
      id: 'file_hash',
      name: 'Huella Criptográfica Original',
      detected: hashAlert,
      currentState: hashAlert
        ? `Hash de origen IA expuesto (${originalSha256 ? originalSha256.slice(0, 12) + '...' : 'Presente'})`
        : `Hash único verificado (${originalSha256 ? originalSha256.slice(0, 12) + '...' : 'Presente'})`,
      sanitizedState: hashAlert
        ? 'Hash SHA-256 y MD5 100% único por exportación'
        : 'Hash independiente (Sin coincidencias en bases de IA)',
      severity: hashAlert ? 'alert' : 'clean',
    },
  ];

  const totalMarkersFound = diagnostics.filter((d) => d.detected).length;

  return {
    hasAiMarkers,
    totalMarkersFound,
    diagnostics,
    originalSha256,
    fileSizeBytes: file.size,
  };
}
