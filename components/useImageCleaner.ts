'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ForensicsReport } from '@/lib/forensicsScanner';
import { scanImageForensics } from '@/lib/imageForensicsScanner';
import { detectImageFormat, ImageFormat, ImageFormatInfo } from '@/lib/imageFormatDetector';
import {
  processImageMode1,
  processImageMode2,
  processImageMode3,
} from '@/lib/imageEngine';
import {
  ProcessingStep,
  SessionLogEntry,
  CleanSingleResult,
  CleanVariantResult,
  LicenseFeaturesGating,
} from './useFFmpegCleaner';

export interface UseImageCleanerReturn {
  engineStatus: 'idle' | 'loading' | 'ready' | 'error';
  engineError: string | null;
  selectedFile: File | null;
  originalPreviewUrl: string | null;
  imageFormatInfo: ImageFormatInfo | null;
  forensicsReport: ForensicsReport | null;
  isScanning: boolean;
  isProcessing: boolean;
  progressPercent: number;
  currentStep: ProcessingStep;
  stepMessage: string;
  processingTimeSec: string | null;
  processError: string | null;
  sessionLogs: SessionLogEntry[];
  singleResult: CleanSingleResult | null;
  variantResults: CleanVariantResult[];
  selectFile: (file: File) => Promise<void>;
  clearFile: () => Promise<void>;
  clearSessionLogs: () => void;
  executeClean: (
    mode: 'fast' | 'deep' | 'spoofer',
    variantCount?: 3 | 5 | 10,
    licenseFeatures?: LicenseFeaturesGating
  ) => Promise<void>;
}

const CROP_SEEDS = [0.99, 0.988, 0.992, 0.986, 0.994, 0.991, 0.989, 0.993, 0.987, 0.995];

export function useImageCleaner(): UseImageCleanerReturn {
  const [engineStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('ready');
  const [engineError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [imageFormatInfo, setImageFormatInfo] = useState<ImageFormatInfo | null>(null);
  const [forensicsReport, setForensicsReport] = useState<ForensicsReport | null>(null);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('idle');
  const [stepMessage, setStepMessage] = useState<string>('Esperando archivo de imagen...');
  const [processingTimeSec, setProcessingTimeSec] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);
  const [singleResult, setSingleResult] = useState<CleanSingleResult | null>(null);
  const [variantResults, setVariantResults] = useState<CleanVariantResult[]>([]);

  // Ref tracking active Object URLs for strict memory leak prevention
  const activeBlobUrlsRef = useRef<Set<string>>(new Set());

  const addLog = useCallback(
    (type: SessionLogEntry['type'], message: string) => {
      const entry: SessionLogEntry = {
        id: `img_log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour12: false }),
        type,
        message,
      };
      setSessionLogs((prev) => [...prev, entry]);
    },
    []
  );

  const registerBlobUrl = useCallback((url: string) => {
    activeBlobUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeAllBlobUrls = useCallback(() => {
    activeBlobUrlsRef.current.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    activeBlobUrlsRef.current.clear();
  }, []);

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      revokeAllBlobUrls();
    };
  }, [revokeAllBlobUrls]);

  const clearSessionLogs = useCallback(() => {
    setSessionLogs([]);
  }, []);

  const clearFile = useCallback(async () => {
    revokeAllBlobUrls();
    setSelectedFile(null);
    setOriginalPreviewUrl(null);
    setImageFormatInfo(null);
    setForensicsReport(null);
    setSingleResult(null);
    setVariantResults([]);
    setCurrentStep('idle');
    setProgressPercent(0);
    setStepMessage('Esperando archivo de imagen...');
    setProcessError(null);
    setProcessingTimeSec(null);
  }, [revokeAllBlobUrls]);

  const selectFile = useCallback(
    async (file: File) => {
      await clearFile();
      setProcessError(null);
      setIsScanning(true);
      setCurrentStep('scanning');
      setStepMessage('Analizando cabeceras y estructura binaria de la imagen...');
      addLog('info', `Archivo seleccionado: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

      try {
        const buffer = await file.arrayBuffer();
        const detected = detectImageFormat(new Uint8Array(buffer));

        if (!detected) {
          const errMsg = 'Formato de imagen no reconocido o archivo dañado.';
          setProcessError(errMsg);
          addLog('error', errMsg);
          setIsScanning(false);
          setCurrentStep('error');
          return;
        }

        setImageFormatInfo(detected);
        addLog('info', `Formato detectado por magic bytes: ${detected.format.toUpperCase()} (${detected.mimeType})`);

        // Create preview URL
        const previewUrl = registerBlobUrl(URL.createObjectURL(file));
        setSelectedFile(file);
        setOriginalPreviewUrl(previewUrl);

        // Perform forensic scan
        addLog('info', 'Ejecutando auditoría forense de dos capas en la imagen...');
        const report = await scanImageForensics(file);
        setForensicsReport(report);

        if (report.hasAiMarkers) {
          addLog(
            'warn',
            `Alerta Forense: Detectados ${report.totalMarkersFound} marcadores generativos/C2PA en la imagen original.`
          );
        } else {
          addLog('success', 'Auditoría Forense: Imagen analizada sin marcadores C2PA hostiles.');
        }

        setCurrentStep('idle');
        setStepMessage('Imagen lista para sanitización');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error desconocido al cargar la imagen';
        setProcessError(msg);
        addLog('error', `Fallo al procesar imagen: ${msg}`);
        setCurrentStep('error');
      } finally {
        setIsScanning(false);
      }
    },
    [clearFile, addLog, registerBlobUrl]
  );

  const executeClean = useCallback(
    async (
      mode: 'fast' | 'deep' | 'spoofer',
      variantCount: 3 | 5 | 10 = 3,
      licenseFeatures?: LicenseFeaturesGating
    ) => {
      if (!selectedFile) {
        setProcessError('Selecciona primero una imagen para procesar.');
        return;
      }

      // Feature gating
      if (mode === 'deep' && !licenseFeatures?.modeDeepAntiSynthID) {
        const err = 'El Modo Blindaje Anti-SynthID requiere un plan Creator o Agency activo.';
        setProcessError(err);
        addLog('warn', err);
        return;
      }

      if (mode === 'spoofer' && !licenseFeatures?.modeMultiVariant) {
        const err = 'El Modo Multi-Variante requiere un plan Agency activo.';
        setProcessError(err);
        addLog('warn', err);
        return;
      }

      setIsProcessing(true);
      setProcessError(null);
      setProgressPercent(0);
      setSingleResult(null);
      setVariantResults([]);
      const startTime = performance.now();

      try {
        if (mode === 'fast') {
          setCurrentStep('stripping');
          setStepMessage('Modo 1: Ejecutando purga binaria sin pérdidas de metadatos...');
          addLog('info', 'Iniciando Modo 1: Purga total de contenedores EXIF, IPTC, XMP y C2PA...');

          const res = await processImageMode1(selectedFile, (p) => {
            setProgressPercent(p.percent);
            setStepMessage(p.stage);
          });

          const cleanUrl = registerBlobUrl(URL.createObjectURL(res.blob));
          const extension = imageFormatInfo?.extension || 'jpg';
          const cleanName = `clean_${selectedFile.name.replace(/\.[^/.]+$/, '')}.${extension}`;

          setSingleResult({
            blobUrl: cleanUrl,
            fileName: cleanName,
            fileSize: res.buffer.byteLength,
            sha256: res.sha256,
            md5: res.md5,
            mode: 'fast',
            durationSec: 0,
            verdict:
              'Protección de Metadatos Activa: Manifiestos C2PA y etiquetas de procedencia purgados al 100% (ideal para redes que inspeccionan cabeceras)',
          });

          addLog('success', `Modo 1 finalizado: SHA-256 ${res.sha256.slice(0, 16)}...`);
        } else if (mode === 'deep') {
          setCurrentStep('shielding');
          setStepMessage('Modo 2: Aplicando blindaje Anti-SynthID y remuestreo estocástico...');
          addLog('info', 'Iniciando Modo 2: Micro-crop 0.99x + remuestreo espacial bilineal + micro-ruido estocástico...');

          const res = await processImageMode2(selectedFile, (p) => {
            setProgressPercent(p.percent);
            setStepMessage(p.stage);
          });

          const cleanUrl = registerBlobUrl(URL.createObjectURL(res.blob));
          const extension = imageFormatInfo?.extension || 'jpg';
          const shieldedName = `shielded_${selectedFile.name.replace(/\.[^/.]+$/, '')}.${extension}`;

          setSingleResult({
            blobUrl: cleanUrl,
            fileName: shieldedName,
            fileSize: res.buffer.byteLength,
            sha256: res.sha256,
            md5: res.md5,
            mode: 'deep',
            durationSec: 0,
            verdict:
              'Blindaje Total: Metadatos purgados + Matriz espacial de píxeles alterada contra rastreadores invisibles SynthID',
          });

          addLog(
            'success',
            `Modo 2 finalizado: Distancia perceptual Hamming = ${res.perceptualDistance}. SHA-256 ${res.sha256.slice(0, 16)}...`
          );
        } else if (mode === 'spoofer') {
          setCurrentStep('variants');
          setStepMessage(`Modo 3: Generando ${variantCount} variantes únicas...`);
          addLog('info', `Iniciando Modo 3 Agency Spoofer: Creación de ${variantCount} copias únicas...`);

          const variants = await processImageMode3(selectedFile, variantCount, (p) => {
            setProgressPercent(p.percent);
            setStepMessage(p.stage);
          });

          const extension = imageFormatInfo?.extension || 'jpg';
          const baseName = selectedFile.name.replace(/\.[^/.]+$/, '');

          const mappedVariants: CleanVariantResult[] = variants.map((v) => {
            const vUrl = registerBlobUrl(URL.createObjectURL(v.blob));
            return {
              variantIndex: v.id,
              blobUrl: vUrl,
              fileName: `variant_${v.id}_${baseName}.${extension}`,
              fileSize: v.buffer.byteLength,
              sha256: v.sha256,
              md5: v.md5,
              cropFactor: CROP_SEEDS[(v.id - 1) % CROP_SEEDS.length],
            };
          });

          setVariantResults(mappedVariants);
          addLog('success', `Modo 3 finalizado: ${variants.length} variantes únicas generadas con éxito.`);
        }

        const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
        setProcessingTimeSec(elapsedSec);
        setCurrentStep('completed');
        setProgressPercent(100);
        setStepMessage(`Procesamiento completado en ${elapsedSec}s`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Error al procesar la imagen';
        setProcessError(msg);
        addLog('error', `Error durante el procesamiento: ${msg}`);
        setCurrentStep('error');
      } finally {
        setIsProcessing(false);
      }
    },
    [selectedFile, imageFormatInfo, addLog, registerBlobUrl]
  );

  return {
    engineStatus,
    engineError,
    selectedFile,
    originalPreviewUrl,
    imageFormatInfo,
    forensicsReport,
    isScanning,
    isProcessing,
    progressPercent,
    currentStep,
    stepMessage,
    processingTimeSec,
    processError,
    sessionLogs,
    singleResult,
    variantResults,
    selectFile,
    clearFile,
    clearSessionLogs,
    executeClean,
  };
}
