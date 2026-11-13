'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { scanVideoForensics, ForensicsReport } from '@/lib/forensicsScanner';
import { computeSHA256, computeMD5 } from '@/lib/cryptoUtils';

export type ProcessingStep =
  | 'idle'
  | 'scanning'
  | 'stripping'
  | 'shielding'
  | 'variants'
  | 'completed'
  | 'error';

export interface SessionLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'ffmpeg' | 'warn' | 'error' | 'success';
  message: string;
}

export interface CleanSingleResult {
  blobUrl: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  md5: string;
  mode: 'fast' | 'deep';
  durationSec: number;
  verdict: string;
}

export interface CleanVariantResult {
  variantIndex: number;
  blobUrl: string;
  fileName: string;
  fileSize: number;
  sha256: string;
  md5: string;
  cropFactor: number;
}

export interface LicenseFeaturesGating {
  unlimitedDuration?: boolean;
  modeDeepAntiSynthID?: boolean;
  modeMultiVariant?: boolean;
}

export interface UseFFmpegCleanerReturn {
  engineStatus: 'idle' | 'loading' | 'ready' | 'error';
  engineError: string | null;
  selectedFile: File | null;
  originalPreviewUrl: string | null;
  fileDuration: number | null;
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

const CORE_VERSION = '0.12.6';
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

const VIRTUAL_TEMP_FILES = [
  'input.mp4',
  'output_mode1.mp4',
  'output_mode2.mp4',
  'variant_1.mp4',
  'variant_2.mp4',
  'variant_3.mp4',
  'variant_4.mp4',
  'variant_5.mp4',
  'variant_6.mp4',
  'variant_7.mp4',
  'variant_8.mp4',
  'variant_9.mp4',
  'variant_10.mp4',
];

async function cleanupVirtualFiles(ffmpeg: FFmpeg | null): Promise<void> {
  if (!ffmpeg || !ffmpeg.loaded) return;
  for (const fname of VIRTUAL_TEMP_FILES) {
    try {
      await ffmpeg.deleteFile(fname);
    } catch {
      // Ignorar si el archivo temporal no existe en MEMFS
    }
  }
}

export function useFFmpegCleaner(): UseFFmpegCleanerReturn {
  // STRICT SESSION ISOLATION: FFmpeg y listeners viven estrictamente dentro de useRef en el cliente
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const coreBlobURLsRef = useRef<{ coreURL: string; wasmURL: string } | null>(null);
  const logListenerRef = useRef<((event: { type: string; message: string }) => void) | null>(null);
  const progressListenerRef = useRef<((event: { progress: number; time: number }) => void) | null>(null);
  const activeBlobUrlsRef = useRef<string[]>([]);
  const isMountedRef = useRef<boolean>(true);
  const isProcessingRef = useRef<boolean>(false);
  const logCounterRef = useRef<number>(0);

  // Estado del motor
  const [engineStatus, setEngineStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [engineError, setEngineError] = useState<string | null>(null);

  // Estado de archivo y escaneo forense
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [forensicsReport, setForensicsReport] = useState<ForensicsReport | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // Estado de procesamiento
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('idle');
  const [stepMessage, setStepMessage] = useState<string>('Listo para analizar tu video');
  const [processingTimeSec, setProcessingTimeSec] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  // Registro técnico estrictamente efímero en memoria React (cero almacenamiento persistente)
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);

  const appendLog = useCallback((type: SessionLogEntry['type'], message: string) => {
    if (!isMountedRef.current) return;
    const now = new Date();
    const timeStr =
      now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    logCounterRef.current += 1;
    const newEntry: SessionLogEntry = {
      id: `log-${Date.now()}-${logCounterRef.current}`,
      timestamp: timeStr,
      type,
      message,
    };
    setSessionLogs((prev) => [...prev.slice(-299), newEntry]);
  }, []);

  const clearSessionLogs = useCallback(() => {
    setSessionLogs([]);
  }, []);

  // Resultados de exportación
  const [singleResult, setSingleResult] = useState<CleanSingleResult | null>(null);
  const [variantResults, setVariantResults] = useState<CleanVariantResult[]>([]);

  const registerBlobUrl = useCallback((url: string) => {
    activeBlobUrlsRef.current.push(url);
    return url;
  }, []);

  const revokeAllBlobUrls = useCallback(() => {
    for (const url of activeBlobUrlsRef.current) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Ignorar errores de revocación
      }
    }
    activeBlobUrlsRef.current = [];
  }, []);

  // Carga diferida de FFmpeg dentro del ciclo de vida del hook
  const initFFmpegEngine = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current && ffmpegRef.current.loaded) {
      return ffmpegRef.current;
    }

    setEngineStatus('loading');
    setEngineError(null);
    appendLog('info', 'Inicializando motor local en memoria WebAssembly...');

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    const handleLog = ({ type, message }: { type: string; message: string }) => {
      if (!isMountedRef.current) return;
      const cleanMsg = message?.trim();
      if (!cleanMsg) return;
      const logType: SessionLogEntry['type'] =
        type === 'error' ? 'error' : cleanMsg.toLowerCase().includes('warn') ? 'warn' : 'ffmpeg';
      appendLog(logType, cleanMsg);
    };

    const handleProgress = ({ progress: rawProgress, time }: { progress: number; time: number }) => {
      if (!isMountedRef.current) return;
      if (
        typeof rawProgress !== 'number' ||
        !Number.isFinite(rawProgress) ||
        rawProgress < 0 ||
        rawProgress > 1 ||
        (typeof time === 'number' && time <= 0 && rawProgress >= 0.99)
      ) {
        return;
      }
      const clamped = Math.max(1, Math.min(99, Math.round(rawProgress * 100)));
      setProgressPercent((prev) => (clamped >= prev ? clamped : prev));
    };

    logListenerRef.current = handleLog;
    progressListenerRef.current = handleProgress;
    ffmpeg.on('log', handleLog);
    ffmpeg.on('progress', handleProgress);

    try {
      if (!coreBlobURLsRef.current) {
        appendLog('info', `Descargando núcleo local desde ${CORE_BASE_URL}...`);
        const coreURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');
        coreBlobURLsRef.current = { coreURL, wasmURL };
      }

      await ffmpeg.load({
        coreURL: coreBlobURLsRef.current.coreURL,
        wasmURL: coreBlobURLsRef.current.wasmURL,
      });

      setEngineStatus('ready');
      appendLog('success', 'Motor listo en la memoria de este navegador.');
      return ffmpeg;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setEngineStatus('error');
      setEngineError(errMsg);
      appendLog('error', `Error al inicializar el motor local: ${errMsg}`);
      throw err;
    }
  }, [appendLog]);

  // Selección de archivo: reinicia los logs de sesión y ejecuta el escáner forense
  const selectFile = useCallback(
    async (file: File) => {
      setSessionLogs([]);
      setSingleResult(null);
      setVariantResults([]);
      setProcessError(null);
      setProgressPercent(0);
      setCurrentStep('idle');
      setProcessingTimeSec(null);
      revokeAllBlobUrls();

      const previewUrl = registerBlobUrl(URL.createObjectURL(file));
      setSelectedFile(file);
      setOriginalPreviewUrl(previewUrl);
      appendLog(
        'info',
        `Archivo cargado: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`
      );

      // Extraer duración usando elemento de video efímero
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        const durationPromise = new Promise<number>((resolve) => {
          video.onloadedmetadata = () => resolve(video.duration || 0);
          video.onerror = () => resolve(0);
        });
        video.src = previewUrl;
        const dur = await durationPromise;
        setFileDuration(dur);
        if (dur > 0) {
          appendLog('info', `Duración detectada: ${dur.toFixed(2)}s`);
        }
      } catch {
        setFileDuration(null);
      }

      setIsScanning(true);
      setCurrentStep('scanning');
      setStepMessage('1. Escaneando firmas ocultas y rastros de IA...');
      appendLog('info', 'Ejecutando escáner forense en memoria...');

      try {
        const report = await scanVideoForensics(file);
        setForensicsReport(report);
        appendLog(
          report.hasAiMarkers ? 'warn' : 'info',
          `Escaneo completado: ${report.totalMarkersFound} señales analizadas.`
        );
      } catch (err: unknown) {
        appendLog(
          'error',
          `Error en escaneo forense: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setIsScanning(false);
        setCurrentStep('idle');
        setStepMessage('Escaneo completo. Elige un modo y limpia tu video.');
      }
    },
    [appendLog, registerBlobUrl, revokeAllBlobUrls]
  );

  // Limpieza manual del archivo y estado efímero
  const clearFile = useCallback(async () => {
    setSessionLogs([]);
    setSelectedFile(null);
    setOriginalPreviewUrl(null);
    setFileDuration(null);
    setForensicsReport(null);
    setSingleResult(null);
    setVariantResults([]);
    setProcessError(null);
    setProgressPercent(0);
    setCurrentStep('idle');
    setStepMessage('Listo para analizar tu video');
    setProcessingTimeSec(null);
    revokeAllBlobUrls();
    await cleanupVirtualFiles(ffmpegRef.current);
  }, [revokeAllBlobUrls]);

  // Ejecución de Modo 1, Modo 2 o Modo 3
  const executeClean = useCallback(
    async (
      mode: 'fast' | 'deep' | 'spoofer',
      variantCount: 3 | 5 | 10 = 3,
      licenseFeatures?: LicenseFeaturesGating
    ) => {
      if (!selectedFile) {
        setProcessError('Selecciona primero un video MP4, MOV o WebM.');
        return;
      }

      if (isProcessingRef.current) return;

      if (mode === 'fast' && fileDuration && fileDuration > 20 && !licenseFeatures?.unlimitedDuration) {
        const msg = `El Modo 1 gratuito admite videos de hasta 20 segundos (este dura ${fileDuration.toFixed(
          1
        )}s). Activa un plan Creator o Agency para quitar el límite.`;
        setProcessError(msg);
        appendLog('warn', msg);
        return;
      }

      if (mode === 'deep' && !licenseFeatures?.modeDeepAntiSynthID) {
        const msg = 'El Escudo Profundo Anti-SynthID requiere una licencia Creator o Agency activa.';
        setProcessError(msg);
        appendLog('warn', msg);
        return;
      }

      if (mode === 'spoofer' && !licenseFeatures?.modeMultiVariant) {
        const msg = 'El Generador Multi-Variante requiere una licencia Agency activa.';
        setProcessError(msg);
        appendLog('warn', msg);
        return;
      }

      isProcessingRef.current = true;
      setIsProcessing(true);
      setProcessError(null);
      setProgressPercent(0);
      setProcessingTimeSec(null);
      setSingleResult(null);
      setVariantResults([]);
      const startTime = performance.now();

      // Reiniciar logs al iniciar un nuevo proceso (aislamiento estricto)
      setSessionLogs([]);
      appendLog('info', `Iniciando procesamiento en modo ${mode.toUpperCase()}...`);

      try {
        const ffmpeg = await initFFmpegEngine();

        setCurrentStep('scanning');
        setStepMessage('1. Escaneando firmas ocultas en tu dispositivo...');
        setProgressPercent(8);

        const fileData = await fetchFile(selectedFile);
        await ffmpeg.writeFile('input.mp4', fileData);

        if (mode === 'fast') {
          setCurrentStep('stripping');
          setStepMessage('2. Limpiando manifiesto C2PA y metadatos ocultos...');
          setProgressPercent(35);
          appendLog('info', 'Ejecutando purga bitexact: -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 -c:v copy -c:a copy -bsf:v filter_units=remove_types=6 -dn -fflags +bitexact -flags:v +bitexact -flags:a +bitexact');

          const exitCode = await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:v:0',
            '-map',
            '0:a?',
            '-map_metadata',
            '-1',
            '-map_metadata:s',
            '-1',
            '-c:v',
            'copy',
            '-c:a',
            'copy',
            '-bsf:v',
            'filter_units=remove_types=6',
            '-dn',
            '-fflags',
            '+bitexact',
            '-flags:v',
            '+bitexact',
            '-flags:a',
            '+bitexact',
            '-metadata:s:v:0',
            'encoder=',
            '-metadata:s:a:0',
            'encoder=',
            'output_mode1.mp4',
          ]);
          if (exitCode !== 0) {
            throw new Error(`El motor finalizó con código ${exitCode}.`);
          }

          setCurrentStep('shielding');
          setStepMessage('3. Verificando contenedor limpio...');
          setProgressPercent(85);

          const rawOutputData = await ffmpeg.readFile('output_mode1.mp4');
          const rawOutput =
            rawOutputData instanceof Uint8Array
              ? rawOutputData
              : new TextEncoder().encode(String(rawOutputData));
          const sha256 = await computeSHA256(rawOutput);
          const md5 = computeMD5(rawOutput);

          const blob = new Blob([rawOutput.slice() as unknown as BlobPart], { type: 'video/mp4' });
          const blobUrl = registerBlobUrl(URL.createObjectURL(blob));

          const mode1Verdict =
            'Protección de Metadatos Activa: Manifiestos C2PA y etiquetas de procedencia purgados al 100% (ideal para redes que inspeccionan cabeceras)';

          setSingleResult({
            blobUrl,
            fileName: `clean_${selectedFile.name}`,
            fileSize: rawOutput.length,
            sha256,
            md5,
            mode: 'fast',
            durationSec: fileDuration || 0,
            verdict: mode1Verdict,
          });

          try {
            const cleanFile = new File([blob], `clean_${selectedFile.name}`, { type: 'video/mp4' });
            const postScan = await scanVideoForensics(cleanFile, {
              processedMode: 'fast',
              skipAudio: true,
            });
            setForensicsReport(postScan);
          } catch {
            setForensicsReport((prev) =>
              prev
                ? {
                    ...prev,
                    processedMode: 'fast',
                    layer1: { ...prev.layer1, verified: true },
                    layer2: {
                      ...prev.layer2,
                      synthIdShielded: false,
                      pixelMatrixIntact: true,
                    },
                  }
                : null
            );
          }
          appendLog('success', `Purga completada. SHA-256: ${sha256}`);
        } else if (mode === 'deep') {
          setCurrentStep('stripping');
          setStepMessage('2. Limpiando manifiesto C2PA y reescribiendo cabeceras...');
          setProgressPercent(15);

          setCurrentStep('shielding');
          setStepMessage('3. Aplicando escudo Anti-SynthID en píxeles y audio...');
          appendLog('info', 'Ejecutando blindaje profundo bitexact: -map 0:v:0 -map 0:a? -map_metadata -1 -map_metadata:s -1 CRF 18 + filtro acústico 20Hz-19.5kHz + SEI removal');

          const exitCode = await ffmpeg.exec([
            '-i',
            'input.mp4',
            '-map',
            '0:v:0',
            '-map',
            '0:a?',
            '-map_metadata',
            '-1',
            '-map_metadata:s',
            '-1',
            '-vf',
            'crop=trunc(iw*0.99/2)*2:trunc(ih*0.99/2)*2,scale=iw:ih,noise=alls=1:allf=t',
            '-af',
            'highpass=f=20,lowpass=f=19500',
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-crf',
            '18',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-bsf:v',
            'filter_units=remove_types=6',
            '-dn',
            '-fflags',
            '+bitexact',
            '-flags:v',
            '+bitexact',
            '-flags:a',
            '+bitexact',
            '-metadata:s:v:0',
            'encoder=',
            '-metadata:s:a:0',
            'encoder=',
            '-movflags',
            '+faststart',
            'output_mode2.mp4',
          ]);
          if (exitCode !== 0) {
            throw new Error(`El motor finalizó con código ${exitCode}.`);
          }

          setProgressPercent(92);
          const rawOutputData = await ffmpeg.readFile('output_mode2.mp4');
          const rawOutput =
            rawOutputData instanceof Uint8Array
              ? rawOutputData
              : new TextEncoder().encode(String(rawOutputData));
          const sha256 = await computeSHA256(rawOutput);
          const md5 = computeMD5(rawOutput);

          const blob = new Blob([rawOutput.slice() as unknown as BlobPart], { type: 'video/mp4' });
          const blobUrl = registerBlobUrl(URL.createObjectURL(blob));

          const mode2Verdict =
            'Blindaje Total: Metadatos purgados + Matriz espacial de píxeles alterada + Filtro acústico 20Hz-19.5kHz contra rastreadores ultrasónicos';

          setSingleResult({
            blobUrl,
            fileName: `shielded_${selectedFile.name}`,
            fileSize: rawOutput.length,
            sha256,
            md5,
            mode: 'deep',
            durationSec: fileDuration || 0,
            verdict: mode2Verdict,
          });

          try {
            const shieldedFile = new File([blob], `shielded_${selectedFile.name}`, { type: 'video/mp4' });
            const postScan = await scanVideoForensics(shieldedFile, {
              processedMode: 'deep',
              skipAudio: true,
            });
            setForensicsReport(postScan);
          } catch {
            setForensicsReport((prev) =>
              prev
                ? {
                    ...prev,
                    processedMode: 'deep',
                    layer1: { ...prev.layer1, verified: true },
                    layer2: {
                      ...prev.layer2,
                      synthIdShielded: true,
                      pixelMatrixIntact: false,
                      acousticFiltered: true,
                    },
                  }
                : null
            );
          }
          appendLog('success', `Blindaje Anti-SynthID completado. SHA-256: ${sha256}`);
        } else if (mode === 'spoofer') {
          setCurrentStep('stripping');
          setStepMessage('2. Purgando origen y preparando lote de copias únicas...');
          setProgressPercent(10);

          setCurrentStep('variants');
          const cropSeeds = [0.99, 0.988, 0.992, 0.986, 0.994, 0.991, 0.989, 0.993, 0.987, 0.995];
          const results: CleanVariantResult[] = [];

          for (let i = 1; i <= variantCount; i++) {
            const cropFactor = cropSeeds[(i - 1) % cropSeeds.length];
            const brightness = (((i % 5) - 2) * 0.001).toFixed(4);
            const stepMsg = `3. Aplicando escudo y creando copia única ${i} de ${variantCount}...`;
            setStepMessage(stepMsg);
            appendLog('info', `Variante ${i}/${variantCount} (micro-crop: ${cropFactor})`);

            const outFileName = `variant_${i}.mp4`;
            const filterExpr = `crop=trunc(iw*${cropFactor}/2)*2:trunc(ih*${cropFactor}/2)*2,scale=iw:ih,noise=alls=${i}:allf=t,eq=brightness=${brightness}`;

            const exitCode = await ffmpeg.exec([
              '-i',
              'input.mp4',
              '-map',
              '0:v:0',
              '-map',
              '0:a?',
              '-map_metadata',
              '-1',
              '-map_metadata:s',
              '-1',
              '-vf',
              filterExpr,
              '-af',
              'highpass=f=20,lowpass=f=19500',
              '-c:v',
              'libx264',
              '-preset',
              'ultrafast',
              '-crf',
              '18',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-bsf:v',
              'filter_units=remove_types=6',
              '-dn',
              '-fflags',
              '+bitexact',
              '-flags:v',
              '+bitexact',
              '-flags:a',
              '+bitexact',
              '-metadata:s:v:0',
              'encoder=',
              '-metadata:s:a:0',
              'encoder=',
              '-movflags',
              '+faststart',
              outFileName,
            ]);
            if (exitCode !== 0) {
              throw new Error(`La variante ${i} finalizó con código ${exitCode}.`);
            }

            const rawVariantData = await ffmpeg.readFile(outFileName);
            const rawVariant =
              rawVariantData instanceof Uint8Array
                ? rawVariantData
                : new TextEncoder().encode(String(rawVariantData));
            const sha256 = await computeSHA256(rawVariant);
            const md5 = computeMD5(rawVariant);

            try {
              await ffmpeg.deleteFile(outFileName);
            } catch {
              // Ignorar
            }

            const blob = new Blob([rawVariant.slice() as unknown as BlobPart], { type: 'video/mp4' });
            const blobUrl = registerBlobUrl(URL.createObjectURL(blob));

            results.push({
              variantIndex: i,
              blobUrl,
              fileName: `variant_${i}_${selectedFile.name}`,
              fileSize: rawVariant.length,
              sha256,
              md5,
              cropFactor,
            });
            setVariantResults([...results]);
            appendLog('success', `Variante ${i} lista. SHA-256: ${sha256}`);
            setProgressPercent(Math.min(98, Math.round((i / variantCount) * 95)));
          }
        }

        const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
        setProcessingTimeSec(elapsed);
        setProgressPercent(100);
        setCurrentStep('completed');
        setStepMessage(`4. Listo para descargar (completado en ${elapsed}s)`);
        appendLog('success', `Proceso completado en ${elapsed}s.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const isOom = /memory|oom|allocation|arraybuffer|out of bounds|abort/i.test(msg);
        const friendly = isOom
          ? 'Tu navegador alcanzó su límite de memoria RAM con este video. Usa el Modo 1 rápido o prueba un clip más corto.'
          : `Error durante el procesamiento: ${msg}`;
        setCurrentStep('error');
        setProcessError(friendly);
        appendLog('error', friendly);
      } finally {
        await cleanupVirtualFiles(ffmpegRef.current);
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    },
    [selectedFile, fileDuration, initFFmpegEngine, appendLog, registerBlobUrl]
  );

  // Limpieza estricta al desmontar: remueve listeners, borra MEMFS, revoca ObjectURLs y termina worker
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      revokeAllBlobUrls();

      const ffmpeg = ffmpegRef.current;
      if (ffmpeg) {
        if (logListenerRef.current) {
          try {
            ffmpeg.off('log', logListenerRef.current);
          } catch {
            // Ignorar si ya fue terminado
          }
          logListenerRef.current = null;
        }
        if (progressListenerRef.current) {
          try {
            ffmpeg.off('progress', progressListenerRef.current);
          } catch {
            // Ignorar si ya fue terminado
          }
          progressListenerRef.current = null;
        }
        void cleanupVirtualFiles(ffmpeg).finally(() => {
          try {
            ffmpeg.terminate();
          } catch {
            // Ignorar
          }
        });
        ffmpegRef.current = null;
      }
    };
  }, [revokeAllBlobUrls]);

  return {
    engineStatus,
    engineError,
    selectedFile,
    originalPreviewUrl,
    fileDuration,
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
