'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {
  Upload,
  Zap,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Download,
  RefreshCw,
  FileVideo,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Trash2,
  Play,
  Sparkles,
  HardDrive,
  Info,
} from 'lucide-react';

type CleaningMode = 'fast' | 'deep';
type EngineStatus = 'idle' | 'loading' | 'ready' | 'error';

interface LogEntry {
  id: number;
  timestamp: string;
  type: string;
  message: string;
}

const CORE_VERSION = '0.12.6';
const CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

// Deduplica la descarga de los binarios WASM (~31 MB) ante doble montaje en React StrictMode
let cachedCoreURLsPromise: Promise<{ coreURL: string; wasmURL: string }> | null = null;

async function getCoreBlobURLs(): Promise<{ coreURL: string; wasmURL: string }> {
  if (!cachedCoreURLsPromise) {
    cachedCoreURLsPromise = (async () => {
      try {
        const coreURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm');
        return { coreURL, wasmURL };
      } catch (err) {
        cachedCoreURLsPromise = null;
        throw err;
      }
    })();
  }
  return cachedCoreURLsPromise;
}

export default function VideoCleaner() {
  // Referencia persistente a la instancia de FFmpeg WebAssembly
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const logCounterRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);
  const isLoadingRef = useRef<boolean>(false);

  // Estado del motor WebAssembly
  const [engineStatus, setEngineStatus] = useState<EngineStatus>('idle');
  const [engineError, setEngineError] = useState<string | null>(null);
  const [crossOriginIsolatedStatus, setCrossOriginIsolatedStatus] = useState<boolean | null>(null);

  // Estado del archivo e interfaz de limpieza
  const [mode, setMode] = useState<CleaningMode>('fast');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null);
  const [outputVideoUrl, setOutputVideoUrl] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>('');
  const [outputSizeMB, setOutputSizeMB] = useState<string | null>(null);

  // Referencias mutables para garantizar revocación segura de Object URLs en el desmontaje
  const inputPreviewUrlRef = useRef<string | null>(null);
  const outputVideoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    inputPreviewUrlRef.current = inputPreviewUrl;
  }, [inputPreviewUrl]);

  useEffect(() => {
    outputVideoUrlRef.current = outputVideoUrl;
  }, [outputVideoUrl]);

  // Estado de ejecución en tiempo real
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [processingTimeSec, setProcessingTimeSec] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);

  // Consola de depuración técnica en vivo
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(false);

  // Función auxiliar para registrar eventos en la consola técnica
  const appendLog = useCallback((type: string, message: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    logCounterRef.current += 1;
    const nextId = logCounterRef.current;

    setLogs((prev) => [
      ...prev.slice(-299),
      {
        id: nextId,
        timestamp: timeStr,
        type,
        message,
      },
    ]);
  }, []);

  // Auto-scroll de la consola cuando se agregan nuevos logs
  useEffect(() => {
    if (isConsoleOpen && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, isConsoleOpen]);

  // Carga del motor FFmpeg desde el CDN oficial usando toBlobURL para evitar bloqueos CORS
  const loadFFmpegEngine = useCallback(async () => {
    if (isLoadingRef.current || ffmpegRef.current?.loaded) return;

    isLoadingRef.current = true;
    setEngineStatus('loading');
    setEngineError(null);

    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    try {
      const isIsolated =
        typeof window !== 'undefined' ? Boolean(window.crossOriginIsolated) : false;
      setCrossOriginIsolatedStatus(isIsolated);

      if (typeof SharedArrayBuffer === 'undefined') {
        appendLog(
          'warn',
          'Aviso: SharedArrayBuffer no detectado en el contexto actual. Verifica que las cabeceras COOP (same-origin) y COEP (require-corp) estén activas en next.config.mjs.'
        );
      } else {
        appendLog(
          'system',
          `Aislamiento Cross-Origin verificado (crossOriginIsolated: ${String(isIsolated)}). SharedArrayBuffer habilitado.`
        );
      }

      // Conexión en vivo a los logs técnicos de FFmpeg
      ffmpeg.on('log', ({ type, message }) => {
        appendLog(type || 'ffmpeg', message);
      });

      // Conexión en vivo a la barra de progreso real (0% - 100%), evitando picos espurios al inicio
      ffmpeg.on('progress', ({ progress: rawProgress, time }) => {
        if (
          typeof rawProgress !== 'number' ||
          !Number.isFinite(rawProgress) ||
          rawProgress < 0 ||
          rawProgress > 1 ||
          (typeof time === 'number' && time <= 0 && rawProgress >= 0.99)
        ) {
          return;
        }
        const clamped = Math.max(0, Math.min(99, Math.round(rawProgress * 100)));
        setProgress((prev) => (clamped >= prev ? clamped : prev));
      });

      appendLog(
        'system',
        `Descargando binarios WebAssembly desde ${CORE_BASE_URL} mediante toBlobURL...`
      );

      const { coreURL, wasmURL } = await getCoreBlobURLs();

      if (!isMountedRef.current || ffmpegRef.current !== ffmpeg) {
        try {
          ffmpeg.terminate();
        } catch {
          // Ignorar si ya fue terminado en desmontaje
        }
        return;
      }

      await ffmpeg.load({
        coreURL,
        wasmURL,
      });

      if (!isMountedRef.current || ffmpegRef.current !== ffmpeg) {
        try {
          ffmpeg.terminate();
        } catch {
          // Ignorar si ya fue terminado en desmontaje
        }
        return;
      }

      setEngineStatus('ready');
      appendLog('system', 'Motor FFmpeg WebAssembly v0.12.6 inicializado y listo en memoria local.');
    } catch (err: unknown) {
      if (!isMountedRef.current || ffmpegRef.current !== ffmpeg) {
        return;
      }
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Error desconocido al inicializar el motor WebAssembly.';
      setEngineStatus('error');
      setEngineError(
        `No se pudo inicializar el motor WebAssembly: ${errorMessage}. Verifica tu conexión a internet o que tu navegador soporte WebAssembly y SharedArrayBuffer.`
      );
      appendLog('error', `Fallo crítico de carga WASM: ${errorMessage}`);
    } finally {
      if (ffmpegRef.current === ffmpeg) {
        isLoadingRef.current = false;
      }
    }
  }, [appendLog]);

  // Inicializar el motor automáticamente al montar el componente en el cliente
  useEffect(() => {
    isMountedRef.current = true;
    loadFFmpegEngine();

    return () => {
      isMountedRef.current = false;
      isLoadingRef.current = false;
      // Limpieza al desmontar el componente garantizando revocación segura de URLs activas
      if (inputPreviewUrlRef.current) {
        URL.revokeObjectURL(inputPreviewUrlRef.current);
      }
      if (outputVideoUrlRef.current) {
        URL.revokeObjectURL(outputVideoUrlRef.current);
      }
      try {
        ffmpegRef.current?.terminate();
      } catch {
        // Ignorar errores al cerrar el worker en desmontaje
      }
      ffmpegRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Validación y carga del archivo seleccionado o arrastrado
  const handleFileSelection = useCallback(
    (file: File | null) => {
      if (!file) return;

      setProcessError(null);

      // Validar extensión o tipo MIME (MP4, MOV, WebM)
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
      const validExtensions = /\.(mp4|mov|webm)$/i;

      if (!validTypes.includes(file.type) && !validExtensions.test(file.name)) {
        setProcessError(
          'Formato no soportado. Por favor selecciona un archivo de video válido (.MP4, .MOV o .WebM).'
        );
        return;
      }

      // Revocar ObjectURLs previos antes de asignar el nuevo archivo
      if (inputPreviewUrl) {
        URL.revokeObjectURL(inputPreviewUrl);
      }
      if (outputVideoUrl) {
        URL.revokeObjectURL(outputVideoUrl);
        setOutputVideoUrl(null);
      }

      const nextPreviewUrl = URL.createObjectURL(file);
      setSelectedFile(file);
      setInputPreviewUrl(nextPreviewUrl);
      setProgress(0);
      setProcessingTimeSec(null);
      setOutputSizeMB(null);

      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      appendLog(
        'input',
        `Archivo cargado en memoria del navegador: "${file.name}" (${fileSizeMB} MB, tipo: ${file.type || 'video/*'})`
      );

      if (file.size > 250 * 1024 * 1024) {
        appendLog(
          'warn',
          'Advertencia de memoria: El archivo supera los 250 MB. En navegadores móviles con RAM limitada, el Modo Profundo puede exceder el límite del heap de WebAssembly.'
        );
      }
    },
    [appendLog, inputPreviewUrl, outputVideoUrl]
  );

  // Manejadores de Drag & Drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isProcessing) return;

    const droppedFile = e.dataTransfer.files?.[0] || null;
    handleFileSelection(droppedFile);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    handleFileSelection(file);
  };

  // Ejecución del proceso de limpieza en FFmpeg WebAssembly
  const runCleaningProcess = async () => {
    if (!selectedFile) return;

    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || engineStatus !== 'ready') {
      setProcessError(
        'El motor WebAssembly aún no está listo. Espera unos segundos o reintenta la carga.'
      );
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProcessError(null);
    setProcessingTimeSec(null);

    if (outputVideoUrl) {
      URL.revokeObjectURL(outputVideoUrl);
      setOutputVideoUrl(null);
    }

    const startTime = performance.now();
    const inputVirtualName = 'input.mp4';
    const outputVirtualName = 'output.mp4';

    try {
      appendLog('system', `Escribiendo "${selectedFile.name}" en el sistema de archivos virtual MEMFS...`);
      const fileData = await fetchFile(selectedFile);
      await ffmpeg.writeFile(inputVirtualName, fileData);

      // Construcción exacta de los argumentos según el modo seleccionado
      const ffmpegArgs: string[] =
        mode === 'fast'
          ? [
              '-i',
              'input.mp4',
              '-map_metadata',
              '-1',
              '-c:v',
              'copy',
              '-c:a',
              'copy',
              '-fflags',
              '+bitexact',
              'output.mp4',
            ]
          : [
              '-i',
              'input.mp4',
              '-map_metadata',
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
              '-movflags',
              '+faststart',
              'output.mp4',
            ];

      appendLog('cmd', `ffmpeg ${ffmpegArgs.join(' ')}`);

      const exitCode = await ffmpeg.exec(ffmpegArgs);
      if (exitCode !== 0) {
        throw new Error(
          `FFmpeg finalizó con código de salida no exitoso (${exitCode}). Revisa la consola técnica para más detalles.`
        );
      }

      appendLog('system', 'Lectura del archivo procesado desde MEMFS...');
      const outputData = await ffmpeg.readFile(outputVirtualName);

      // Convertir FileData (Uint8Array) a Blob MP4 seguro en memoria
      const uint8Array =
        outputData instanceof Uint8Array
          ? outputData
          : new TextEncoder().encode(String(outputData));

      if (uint8Array.byteLength === 0) {
        throw new Error(
          'El archivo de salida generado está vacío (0 bytes). Es posible que el contenedor original esté dañado o que se haya agotado la memoria RAM.'
        );
      }

      // Crear Blob MP4 usando uint8Array.slice() para garantizar un ArrayBuffer independiente y no compartido
      const outputBlob = new Blob([uint8Array.slice()], { type: 'video/mp4' });
      const cleanUrl = URL.createObjectURL(outputBlob);
      const timestamp = Date.now();
      const generatedName = `clean_video_${timestamp}.mp4`;

      setOutputVideoUrl(cleanUrl);
      setOutputFileName(generatedName);
      setOutputSizeMB((outputBlob.size / (1024 * 1024)).toFixed(2));
      setProgress(100);

      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      setProcessingTimeSec(elapsed);

      appendLog(
        'success',
        `Limpieza completada en ${elapsed}s. Archivo listo: ${generatedName} (${(
          outputBlob.size /
          (1024 * 1024)
        ).toFixed(2)} MB).`
      );
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const isOutOfMemory =
        /memory|oom|allocation|arraybuffer|out of bounds|abort/i.test(rawMessage);

      const friendlyError = isOutOfMemory
        ? 'Memoria RAM insuficiente en el navegador (Out of Memory) al procesar este video. En teléfonos móviles te recomendamos usar el Modo Ultra-Rápido o procesar clips más cortos.'
        : `Error durante el procesamiento multimedia: ${rawMessage}`;

      setProcessError(friendlyError);
      appendLog('error', friendlyError);
    } finally {
      // Liberar siempre los archivos temporales del sistema virtual de FFmpeg tras la ejecución
      try {
        await ffmpeg.deleteFile(inputVirtualName);
        appendLog('cleanup', `Archivo temporal ${inputVirtualName} eliminado de MEMFS.`);
      } catch {
        // El archivo puede no existir si falló antes de escribirse
      }
      try {
        await ffmpeg.deleteFile(outputVirtualName);
        appendLog('cleanup', `Buffer virtual ${outputVirtualName} liberado de MEMFS.`);
      } catch {
        // El archivo de salida puede no existir si falló durante la codificación
      }
      setIsProcessing(false);
    }
  };

  // Botón para procesar otro video: limpia la memoria virtual de FFmpeg y revoca los ObjectURL
  const handleResetAndCleanMemory = async () => {
    const ffmpeg = ffmpegRef.current;

    if (ffmpeg && engineStatus === 'ready') {
      try {
        await ffmpeg.deleteFile('input.mp4');
      } catch {
        // Ya fue eliminado
      }
      try {
        await ffmpeg.deleteFile('output.mp4');
      } catch {
        // Ya fue eliminado
      }
    }

    if (inputPreviewUrl) {
      URL.revokeObjectURL(inputPreviewUrl);
    }
    if (outputVideoUrl) {
      URL.revokeObjectURL(outputVideoUrl);
    }

    setSelectedFile(null);
    setInputPreviewUrl(null);
    setOutputVideoUrl(null);
    setOutputFileName('');
    setOutputSizeMB(null);
    setProgress(0);
    setProcessingTimeSec(null);
    setProcessError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    appendLog(
      'cleanup',
      'Memoria virtual de FFmpeg (deleteFile) y referencias ObjectURL revocadas correctamente. RAM liberada.'
    );
  };

  const formattedInputSizeMB = selectedFile
    ? (selectedFile.size / (1024 * 1024)).toFixed(2)
    : '0.00';

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Barra de Estado del Motor WebAssembly */}
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 p-4 sm:p-5 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800/90 border border-zinc-700/70">
              <Cpu className="w-5 h-5 text-emerald-400" />
              <span
                className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-zinc-900 ${
                  engineStatus === 'ready'
                    ? 'bg-emerald-400'
                    : engineStatus === 'loading'
                    ? 'bg-amber-400 animate-ping'
                    : engineStatus === 'error'
                    ? 'bg-rose-500'
                    : 'bg-zinc-500'
                }`}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-zinc-100">
                  Motor Multimedia WebAssembly
                </h2>
                {engineStatus === 'loading' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Cargando motor local...
                  </span>
                )}
                {engineStatus === 'ready' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Listo
                  </span>
                )}
                {engineStatus === 'error' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    Error de inicialización
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Core CDN:{' '}
                <code className="text-zinc-300 font-mono text-[11px]">
                  @ffmpeg/core@0.12.6 (UMD Blob)
                </code>{' '}
                {crossOriginIsolatedStatus !== null && (
                  <span className="ml-1 text-zinc-500">
                    · Cross-Origin Isolated: {crossOriginIsolatedStatus ? 'Activo' : 'Estándar'}
                  </span>
                )}
              </p>
            </div>
          </div>

          {engineStatus === 'error' && (
            <button
              type="button"
              onClick={loadFFmpegEngine}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar Carga
            </button>
          )}
        </div>

        {engineError && (
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5 flex items-start gap-3 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-rose-100">Fallo al inicializar FFmpeg WebAssembly</p>
              <p className="text-rose-200/90 leading-relaxed">{engineError}</p>
            </div>
          </div>
        )}
      </div>

      {/* Selector de Modos de Limpieza */}
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 sm:p-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              1. Selecciona el Modo de Limpieza
            </h3>
            <p className="text-xs text-zinc-400">
              Elige entre purga instantánea de contenedores o reconstrucción profunda de píxeles y espectro de audio.
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/60 self-start sm:self-auto">
            Modo activo: {mode === 'fast' ? 'Ultra-Rápido (Copy)' : 'Profundo Anti-SynthID'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Opción 1: Modo Ultra-Rápido */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setMode('fast')}
            className={`group text-left rounded-xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between ${
              mode === 'fast'
                ? 'border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
                : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
            } ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg border ${
                      mode === 'fast'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-zinc-100 block">
                      Modo Ultra-Rápido
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium">
                      Strip Container Metadata · ~1 segundo
                    </span>
                  </div>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center mt-1 ${
                    mode === 'fast'
                      ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
                      : 'border-zinc-600'
                  }`}
                >
                  {mode === 'fast' && <div className="h-1.5 w-1.5 rounded-full bg-zinc-950" />}
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                Destruye los contenedores binarios <strong className="text-zinc-100">C2PA</strong>,{' '}
                <strong className="text-zinc-100">XMP</strong>,{' '}
                <strong className="text-zinc-100">EXIF</strong> y{' '}
                <strong className="text-zinc-100">udta</strong> sin recodificar el flujo de video ni
                audio. Cero pérdida de calidad y consumo mínimo de batería.
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-800/80">
              <code className="block text-[11px] font-mono text-zinc-400 truncate">
                -map_metadata -1 -c:v copy -c:a copy -fflags +bitexact
              </code>
            </div>
          </button>

          {/* Opción 2: Modo Profundo Anti-SynthID */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => setMode('deep')}
            className={`group text-left rounded-xl p-4 sm:p-5 border transition-all duration-200 flex flex-col justify-between ${
              mode === 'deep'
                ? 'border-cyan-500/80 bg-cyan-500/10 shadow-lg shadow-cyan-500/5'
                : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900'
            } ${isProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`p-2 rounded-lg border ${
                      mode === 'deep'
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-zinc-100 block">
                      Modo Profundo Anti-SynthID
                    </span>
                    <span className="text-[11px] text-cyan-400 font-medium">
                      Pixel + Audio + Metadata Scrubbing
                    </span>
                  </div>
                </div>
                <div
                  className={`h-4 w-4 rounded-full border flex items-center justify-center mt-1 ${
                    mode === 'deep'
                      ? 'border-cyan-400 bg-cyan-400 text-zinc-950'
                      : 'border-zinc-600'
                  }`}
                >
                  {mode === 'deep' && <div className="h-1.5 w-1.5 rounded-full bg-zinc-950" />}
                </div>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                Elimina metadatos, aplica micro-recorte/escalado imperceptible (1%), inyecta ruido
                temporal de luminancia nivel 1 para alterar la matriz matemática de píxeles, y
                filtra el espectro de audio (20Hz–19.5kHz) con recodificación{' '}
                <strong className="text-zinc-100">H.264 CRF 18</strong>.
              </p>
            </div>

            <div className="pt-3 border-t border-zinc-800/80">
              <code className="block text-[11px] font-mono text-zinc-400 truncate">
                -vf crop=trunc(iw*0.99/2)*2:trunc(ih*0.99/2)*2,scale=iw:ih,noise=alls=1:allf=t -af highpass=f=20,lowpass=f=19500
              </code>
            </div>
          </button>
        </div>
      </div>

      {/* Zona Drag & Drop y Vista Previa */}
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/60 p-5 sm:p-6 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              2. Origen Multimedia y Procesamiento
            </h3>
            <p className="text-xs text-zinc-400">
              Selecciona o arrastra un archivo MP4, MOV o WebM desde tu galería móvil o escritorio.
            </p>
          </div>
          {selectedFile && !isProcessing && (
            <button
              type="button"
              onClick={handleResetAndCleanMemory}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-rose-400 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-800/80"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Cambiar archivo</span>
            </button>
          )}
        </div>

        {/* Input oculto para selección táctil o de escritorio */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {!selectedFile ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all duration-200 flex flex-col items-center justify-center min-h-[240px] ${
              isDragging
                ? 'border-emerald-400 bg-emerald-500/10 scale-[0.995]'
                : 'border-zinc-700/80 bg-zinc-950/50 hover:border-emerald-500/50 hover:bg-zinc-900/80'
            }`}
          >
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400">
              <Upload className="w-7 h-7" />
            </div>
            <p className="text-sm sm:text-base font-medium text-zinc-100 mb-1">
              Toca para elegir un video de tu galería o arrástralo aquí
            </p>
            <p className="text-xs text-zinc-400 max-w-md mb-5">
              Formatos compatibles: MP4, MOV y WebM. Procesamiento 100% privado en la memoria local
              del navegador.
            </p>
            <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 transition-colors">
              <FileVideo className="w-4 h-4 text-emerald-400" />
              Explorar Archivos del Dispositivo
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Metadatos del archivo cargado */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400">
                  <FileVideo className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 mt-0.5">
                    <span className="inline-flex items-center gap-1 font-mono text-zinc-300">
                      <HardDrive className="w-3 h-3 text-emerald-400" />
                      {formattedInputSizeMB} MB
                    </span>
                    <span>·</span>
                    <span>{selectedFile.type || 'video/mp4'}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  disabled={isProcessing || engineStatus !== 'ready'}
                  onClick={runCleaningProcess}
                  className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-lg ${
                    isProcessing || engineStatus !== 'ready'
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : mode === 'fast'
                      ? 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-emerald-500/20'
                      : 'bg-cyan-500 text-zinc-950 hover:bg-cyan-400 shadow-cyan-500/20'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Procesando ({progress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>
                        {mode === 'fast'
                          ? 'Ejecutar Limpieza Ultra-Rápida'
                          : 'Ejecutar Limpieza Profunda Anti-SynthID'}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Barra de Progreso Real (0% - 100%) */}
            {(isProcessing || progress > 0) && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200 flex items-center gap-2">
                    {isProcessing ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>
                          {mode === 'fast'
                            ? 'Eliminando contenedores C2PA / XMP / EXIF / udta...'
                            : 'Aplicando micro-escalado, ruido temporal de luminancia y filtro acústico...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Procesamiento finalizado al 100%</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono font-semibold text-emerald-400">{progress}%</span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 rounded-full ${
                      mode === 'fast'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-cyan-500 to-emerald-400'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Bloque de Error con diagnóstico claro en pantalla */}
            {processError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold text-rose-200">
                    No se pudo completar el procesamiento del video
                  </p>
                  <p className="text-rose-200/90 leading-relaxed">{processError}</p>
                </div>
              </div>
            )}

            {/* Comparativa de Vistas Previas: Video Original vs Video Limpio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Vista Previa Original */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Vista Previa · Video Original
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    {formattedInputSizeMB} MB
                  </span>
                </div>

                {inputPreviewUrl && (
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-zinc-800/80">
                    <video
                      src={inputPreviewUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-contain max-h-[320px]"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>Contiene átomos de origen y posibles trazas C2PA / XMP / SynthID.</span>
                </div>
              </div>

              {/* Vista Previa Video Limpio y Acciones de Descarga */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    Resultado · Video Limpio
                  </span>
                  {outputSizeMB && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                      {outputSizeMB} MB {processingTimeSec ? `· ${processingTimeSec}s` : ''}
                    </span>
                  )}
                </div>

                {outputVideoUrl ? (
                  <>
                    <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center border border-emerald-500/30">
                      <video
                        src={outputVideoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain max-h-[320px]"
                      />
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <a
                        href={outputVideoUrl}
                        download={outputFileName}
                        className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl text-sm font-semibold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar Video Limpio ({outputFileName})</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleResetAndCleanMemory}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium bg-zinc-800/90 text-zinc-200 hover:bg-zinc-800 border border-zinc-700/70 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Procesar otro video y liberar memoria RAM</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-900/30 aspect-video flex flex-col items-center justify-center p-6 text-center">
                    <ShieldCheck className="w-8 h-8 text-zinc-600 mb-2" />
                    <p className="text-xs font-medium text-zinc-400">
                      {isProcessing
                        ? 'Sanitizando flujo de video y audio en memoria local...'
                        : 'Presiona el botón de ejecución para generar el video limpio.'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      La vista previa y el botón de descarga directa aparecerán aquí al terminar.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Consola Técnica Colapsable en Tiempo Real */}
      <div className="rounded-2xl border border-zinc-800/90 bg-zinc-900/70 overflow-hidden backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setIsConsoleOpen((prev) => !prev)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-zinc-800/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span className="text-xs sm:text-sm font-semibold text-zinc-200">
              Consola de Depuración FFmpeg en Vivo
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/70">
              {logs.length} eventos
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>{isConsoleOpen ? 'Ocultar logs' : 'Mostrar logs'}</span>
            {isConsoleOpen ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {isConsoleOpen && (
          <div className="border-t border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-900">
              <span className="text-[11px] font-mono text-zinc-500">
                Stream: ffmpeg.on(&apos;log&apos;, ...) &amp; ffmpeg.on(&apos;progress&apos;, ...)
              </span>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[11px] font-mono text-zinc-400 hover:text-zinc-200 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800"
              >
                Limpiar consola
              </button>
            </div>

            <div
              ref={logContainerRef}
              className="h-56 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 pr-2"
            >
              {logs.length === 0 ? (
                <p className="text-zinc-600 italic">
                  Esperando eventos del motor FFmpeg WebAssembly...
                </p>
              ) : (
                logs.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 break-all">
                    <span className="text-zinc-600 shrink-0">[{entry.timestamp}]</span>
                    <span
                      className={`uppercase font-semibold shrink-0 ${
                        entry.type === 'error'
                          ? 'text-rose-400'
                          : entry.type === 'warn'
                          ? 'text-amber-400'
                          : entry.type === 'success'
                          ? 'text-emerald-400'
                          : entry.type === 'cmd'
                          ? 'text-cyan-400'
                          : entry.type === 'cleanup'
                          ? 'text-purple-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      [{entry.type}]
                    </span>
                    <span className="text-zinc-300">{entry.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
