'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  BatchItem,
  formatBytes,
  isImageFile,
  isVideoFile,
  auditBatchItem,
  processBatchImage,
  processBatchVideo,
  generateBatchZip,
} from '@/lib/batchProcessor';
import { ForensicsReport } from '@/lib/forensicsScanner';
import type { FFmpeg } from '@ffmpeg/ffmpeg';

export interface UseBatchCleanerReturn {
  batchItems: BatchItem[];
  isBatchProcessing: boolean;
  overallProgress: number;
  currentProcessingIndex: number;
  selectedItemId: string | null;
  selectedItem: BatchItem | null;
  batchError: string | null;
  batchSuccessMessage: string | null;
  addFiles: (files: FileList | File[]) => Promise<void>;
  removeItem: (id: string) => void;
  clearBatch: () => void;
  selectItem: (id: string | null) => void;
  executeBatch: (
    mode: 'fast' | 'deep' | 'spoofer',
    getFFmpeg?: () => Promise<FFmpeg>
  ) => Promise<void>;
  downloadItem: (item: BatchItem) => void;
  downloadBatchZip: () => Promise<void>;
}

export function useBatchCleaner(): UseBatchCleanerReturn {
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  const activeBlobUrlsRef = useRef<Set<string>>(new Set());

  const registerUrl = useCallback((url: string) => {
    activeBlobUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeUrls = useCallback(() => {
    activeBlobUrlsRef.current.forEach((u) => {
      try { URL.revokeObjectURL(u); } catch { /* ignore */ }
    });
    activeBlobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      revokeUrls();
    };
  }, [revokeUrls]);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setBatchError(null);
    setBatchSuccessMessage(null);

    const newItems: BatchItem[] = fileList.map((file, idx) => {
      const isImg = isImageFile(file);
      const isVid = isVideoFile(file);
      const mediaType: 'image' | 'video' = isImg ? 'image' : isVid ? 'video' : 'image';
      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase() : '';

      return {
        id: `batch_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        file,
        mediaType,
        format: ext,
        sizeBytes: file.size,
        sizeFormatted: formatBytes(file.size),
        status: 'scanning' as const,
        progress: 0,
        stageMessage: 'Escaneando contenedor...',
        forensicsReport: null,
        resultBlob: null,
        resultBuffer: null,
        resultUrl: null,
        resultFileName: null,
      };
    });

    setBatchItems((prev) => {
      const combined = [...prev, ...newItems];
      if (!selectedItemId && combined.length > 0) {
        setSelectedItemId(combined[0].id);
      }
      return combined;
    });

    // Run background audits for each newly added item
    for (const item of newItems) {
      try {
        const report = await auditBatchItem(item);
        setBatchItems((current) =>
          current.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'ready',
                  forensicsReport: report,
                  stageMessage: report.totalMarkersFound > 0
                    ? `${report.totalMarkersFound} firmas detectadas`
                    : 'Limpio (Sin firmas detectadas)',
                }
              : it
          )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setBatchItems((current) =>
          current.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: 'ready',
                  stageMessage: 'Listo para procesar',
                  error: msg,
                }
              : it
          )
        );
      }
    }
  }, [selectedItemId]);

  const removeItem = useCallback((id: string) => {
    setBatchItems((prev) => {
      const filtered = prev.filter((it) => it.id !== id);
      if (selectedItemId === id) {
        setSelectedItemId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  }, [selectedItemId]);

  const clearBatch = useCallback(() => {
    revokeUrls();
    setBatchItems([]);
    setSelectedItemId(null);
    setOverallProgress(0);
    setCurrentProcessingIndex(-1);
    setBatchError(null);
    setBatchSuccessMessage(null);
  }, [revokeUrls]);

  const selectItem = useCallback((id: string | null) => {
    setSelectedItemId(id);
  }, []);

  const executeBatch = useCallback(
    async (
      mode: 'fast' | 'deep' | 'spoofer',
      getFFmpeg?: () => Promise<FFmpeg>
    ) => {
      if (batchItems.length === 0) return;
      setIsBatchProcessing(true);
      setBatchError(null);
      setBatchSuccessMessage(null);
      setOverallProgress(0);

      let ffmpegInstance: FFmpeg | null = null;
      const hasVideos = batchItems.some((it) => it.mediaType === 'video');
      if (hasVideos && getFFmpeg) {
        try {
          ffmpegInstance = await getFFmpeg();
        } catch (err: unknown) {
          setBatchError(`No se pudo inicializar el motor de video FFmpeg: ${err instanceof Error ? err.message : String(err)}`);
          setIsBatchProcessing(false);
          return;
        }
      }

      const totalItems = batchItems.length;

      for (let i = 0; i < totalItems; i++) {
        const item = batchItems[i];
        setCurrentProcessingIndex(i);

        setBatchItems((current) =>
          current.map((it, idx) =>
            idx === i
              ? { ...it, status: 'processing', progress: 5, stageMessage: 'Iniciando limpieza...' }
              : it
          )
        );

        try {
          if (item.mediaType === 'image') {
            const result = await processBatchImage(item, mode, (p, stage) => {
              setBatchItems((current) =>
                current.map((it, idx) =>
                  idx === i ? { ...it, progress: p, stageMessage: stage } : it
                )
              );
            });

            const blobUrl = registerUrl(URL.createObjectURL(result.blob));
            setBatchItems((current) =>
              current.map((it, idx) =>
                idx === i
                  ? {
                      ...it,
                      status: 'done',
                      progress: 100,
                      stageMessage: '✓ Purga 100% completada',
                      resultBlob: result.blob,
                      resultBuffer: result.buffer,
                      resultUrl: blobUrl,
                      resultFileName: result.fileName,
                      sha256: result.sha256,
                      md5: result.md5,
                      forensicsReport: result.postScan,
                    }
                  : it
              )
            );
          } else {
            // Video item
            if (!ffmpegInstance && getFFmpeg) {
              ffmpegInstance = await getFFmpeg();
            }
            if (!ffmpegInstance) {
              throw new Error('Motor FFmpeg no disponible para procesar video.');
            }

            const result = await processBatchVideo(ffmpegInstance, item, mode, (p, stage) => {
              setBatchItems((current) =>
                current.map((it, idx) =>
                  idx === i ? { ...it, progress: p, stageMessage: stage } : it
                )
              );
            });

            const blobUrl = registerUrl(URL.createObjectURL(result.blob));
            setBatchItems((current) =>
              current.map((it, idx) =>
                idx === i
                  ? {
                      ...it,
                      status: 'done',
                      progress: 100,
                      stageMessage: '✓ Video purgado al 100%',
                      resultBlob: result.blob,
                      resultBuffer: result.buffer,
                      resultUrl: blobUrl,
                      resultFileName: result.fileName,
                      sha256: result.sha256,
                      md5: result.md5,
                      forensicsReport: result.postScan,
                    }
                  : it
              )
            );
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setBatchItems((current) =>
            current.map((it, idx) =>
              idx === i
                ? {
                    ...it,
                    status: 'error',
                    progress: 100,
                    stageMessage: 'Error al procesar archivo',
                    error: msg,
                  }
                : it
            )
          );
        }

        const nextProgress = Math.round(((i + 1) / totalItems) * 100);
        setOverallProgress(nextProgress);
      }

      setIsBatchProcessing(false);
      setCurrentProcessingIndex(-1);
      setBatchSuccessMessage(`Lote procesado: ${totalItems} archivos finalizados con éxito.`);
    },
    [batchItems, registerUrl]
  );

  const downloadItem = useCallback((item: BatchItem) => {
    if (!item.resultUrl && !item.resultBlob) return;
    const url = item.resultUrl || (item.resultBlob ? URL.createObjectURL(item.resultBlob) : null);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = item.resultFileName || `clean_${item.file.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const downloadBatchZip = useCallback(async () => {
    try {
      const zipBlob = await generateBatchZip(batchItems);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CleanStream_Lote_Limpiado_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: unknown) {
      setBatchError(`Error al crear archivo ZIP: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [batchItems]);

  const selectedItem = batchItems.find((it) => it.id === selectedItemId) || null;

  return {
    batchItems,
    isBatchProcessing,
    overallProgress,
    currentProcessingIndex,
    selectedItemId,
    selectedItem,
    batchError,
    batchSuccessMessage,
    addFiles,
    removeItem,
    clearBatch,
    selectItem,
    executeBatch,
    downloadItem,
    downloadBatchZip,
  };
}
