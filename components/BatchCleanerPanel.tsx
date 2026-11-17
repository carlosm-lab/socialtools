'use client';

import React from 'react';
import {
  FileVideo,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Play,
  RotateCcw,
  Plus,
  Archive,
  Eye,
  Loader2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { BatchItem } from '@/lib/batchProcessor';
import ForensicsTable from '@/components/ForensicsTable';
import { ProcessingMode } from '@/components/ModeSelector';

interface BatchCleanerPanelProps {
  batchItems: BatchItem[];
  isProcessing: boolean;
  overallProgress: number;
  currentProcessingIndex: number;
  selectedItemId: string | null;
  selectedItem: BatchItem | null;
  activeMode: ProcessingMode;
  onSelectMode: (mode: ProcessingMode) => void;
  onExecuteBatch: () => void;
  onAddMoreFiles: () => void;
  onRemoveItem: (id: string) => void;
  onClearBatch: () => void;
  onSelectItem: (id: string) => void;
  onDownloadItem: (item: BatchItem) => void;
  onDownloadZip: () => void;
  batchError?: string | null;
  batchSuccessMessage?: string | null;
}

export default function BatchCleanerPanel({
  batchItems,
  isProcessing,
  overallProgress,
  currentProcessingIndex,
  selectedItemId,
  selectedItem,
  activeMode,
  onSelectMode,
  onExecuteBatch,
  onAddMoreFiles,
  onRemoveItem,
  onClearBatch,
  onSelectItem,
  onDownloadItem,
  onDownloadZip,
  batchError,
  batchSuccessMessage,
}: BatchCleanerPanelProps) {
  const imageCount = batchItems.filter((i) => i.mediaType === 'image').length;
  const videoCount = batchItems.filter((i) => i.mediaType === 'video').length;
  const completedCount = batchItems.filter((i) => i.status === 'done').length;

  return (
    <div className="bg-white rounded-2xl border border-[#b8d8cf] shadow-sm overflow-hidden">
      {/* Cabecera del Panel de Lote */}
      <div className="p-4 sm:p-6 bg-[#f7fbf9] border-b border-[#b8d8cf]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#335467]">
                Procesamiento por Lotes
              </span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#cfe8e1] text-[#002941]">
                {batchItems.length} {batchItems.length === 1 ? 'archivo' : 'archivos'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-[#002941] mt-0.5">
              Cola de Sanitización ({imageCount} {imageCount === 1 ? 'foto' : 'fotos'}, {videoCount} {videoCount === 1 ? 'video' : 'videos'})
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onAddMoreFiles}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#002941] bg-white border border-[#b8d8cf] rounded-lg hover:bg-[#eaf5f1] transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir archivos
            </button>
            <button
              type="button"
              onClick={onClearBatch}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#7f1d1d] bg-white border border-[#fca5a5] rounded-lg hover:bg-[#fdf2f2] transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Vaciar cola
            </button>
          </div>
        </div>

        {/* Selector de Modo para el Lote */}
        <div className="mt-4 pt-4 border-t border-[#b8d8cf]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#335467]">Modo de limpieza:</span>
            <div className="inline-flex rounded-lg border border-[#b8d8cf] p-0.5 bg-white">
              <button
                type="button"
                onClick={() => onSelectMode('fast')}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeMode === 'fast'
                    ? 'bg-[#002941] text-white shadow-sm'
                    : 'text-[#335467] hover:text-[#002941]'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Purga Rápida C2PA (Modo 1)
              </button>
              <button
                type="button"
                onClick={() => onSelectMode('deep')}
                disabled={isProcessing}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  activeMode === 'deep'
                    ? 'bg-[#002941] text-white shadow-sm'
                    : 'text-[#335467] hover:text-[#002941]'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Escudo Anti-SynthID (Modo 2)
              </button>
            </div>
          </div>

          {/* Botones de acción principales */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onExecuteBatch}
              disabled={isProcessing || batchItems.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#002941] rounded-lg hover:bg-[#003859] transition-colors disabled:opacity-50 shadow-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando lote...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Procesar Todo el Lote ({batchItems.length})
                </>
              )}
            </button>

            {completedCount > 0 && (
              <button
                type="button"
                onClick={onDownloadZip}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#002941] bg-[#cfe8e1] border border-[#b8d8cf] rounded-lg hover:bg-[#b8d8cf] transition-colors shadow-sm"
              >
                <Archive className="w-4 h-4" />
                Descargar Todo (.ZIP)
              </button>
            )}
          </div>
        </div>

        {/* Barra de progreso global */}
        {isProcessing && (
          <div className="mt-4 pt-4 border-t border-[#b8d8cf]/70 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#002941] font-semibold">
              <span>
                Procesando archivo {currentProcessingIndex + 1} de {batchItems.length}...
              </span>
              <span>{overallProgress}%</span>
            </div>
            <div className="w-full h-2 bg-[#cfe8e1]/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#002941] transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Mensaje de error o éxito */}
        {batchError && (
          <div className="mt-3 p-3 rounded-lg bg-[#fdf2f2] text-[#7f1d1d] text-xs flex items-center gap-2 border border-[#fca5a5]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{batchError}</span>
          </div>
        )}
        {batchSuccessMessage && (
          <div className="mt-3 p-3 rounded-lg bg-[#cfe8e1] text-[#002941] text-xs flex items-center gap-2 border border-[#b8d8cf]">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{batchSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Lista / Tabla de archivos en la cola */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#b8d8cf] bg-[#f7fbf9] text-[#335467]">
              <th className="py-2.5 px-4 font-semibold w-[35%]">Archivo</th>
              <th className="py-2.5 px-3 font-semibold w-[15%]">Tipo</th>
              <th className="py-2.5 px-3 font-semibold w-[22%]">Diagnóstico Forense</th>
              <th className="py-2.5 px-3 font-semibold w-[16%]">Estado</th>
              <th className="py-2.5 px-4 font-semibold w-[12%] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#b8d8cf]/60">
            {batchItems.map((item, idx) => {
              const isSelected = item.id === selectedItemId;
              const hasAlerts = (item.forensicsReport?.totalMarkersFound || 0) > 0;

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectItem(item.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#eaf5f1]' : 'hover:bg-[#f7fbf9]'
                  }`}
                >
                  {/* Nombre y peso */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1.5 rounded-lg bg-[#cfe8e1] text-[#002941] shrink-0">
                        {item.mediaType === 'image' ? (
                          <ImageIcon className="w-4 h-4" />
                        ) : (
                          <FileVideo className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[#002941] truncate" title={item.file.name}>
                          {item.file.name}
                        </div>
                        <div className="text-[11px] text-[#335467]">
                          {item.sizeFormatted} • {item.format.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Tipo */}
                  <td className="py-3 px-3 text-[#335467]">
                    {item.mediaType === 'image' ? 'Imagen' : 'Video'}
                  </td>

                  {/* Diagnóstico Forense */}
                  <td className="py-3 px-3">
                    {item.status === 'scanning' ? (
                      <span className="inline-flex items-center gap-1 text-[#335467]">
                        <Loader2 className="w-3 h-3 animate-spin" /> Analizando...
                      </span>
                    ) : item.status === 'done' ? (
                      <span className="inline-flex items-center gap-1 text-[#002941] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#002941]" /> Verificado 100%
                      </span>
                    ) : hasAlerts ? (
                      <span className="inline-flex items-center gap-1 text-[#7f1d1d] font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 text-[#7f1d1d]" />{' '}
                        {item.forensicsReport?.totalMarkersFound} firmas
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#002941]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#002941]" /> Limpio
                      </span>
                    )}
                  </td>

                  {/* Estado del procesamiento */}
                  <td className="py-3 px-3">
                    {item.status === 'processing' ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-[#002941] font-semibold text-[11px]">
                          <Loader2 className="w-3 h-3 animate-spin" /> {item.progress}%
                        </span>
                        <div className="w-24 h-1 bg-[#cfe8e1] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#002941] transition-all duration-200"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : item.status === 'done' ? (
                      <span className="inline-flex items-center gap-1 text-[#002941] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Purgado
                      </span>
                    ) : item.status === 'error' ? (
                      <span className="inline-flex items-center gap-1 text-[#7f1d1d] font-semibold" title={item.error}>
                        <AlertCircle className="w-3.5 h-3.5" /> Error
                      </span>
                    ) : (
                      <span className="text-[#335467]">Listo</span>
                    )}
                  </td>

                  {/* Acciones */}
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectItem(item.id)}
                        className={`p-1.5 rounded hover:bg-[#cfe8e1] text-[#002941] transition-colors ${
                          isSelected ? 'bg-[#cfe8e1]' : ''
                        }`}
                        title="Ver reporte forense de dos capas"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {item.status === 'done' && (
                        <button
                          type="button"
                          onClick={() => onDownloadItem(item)}
                          className="p-1.5 rounded hover:bg-[#cfe8e1] text-[#002941] transition-colors"
                          title="Descargar archivo limpio"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => onRemoveItem(item.id)}
                        className="p-1.5 rounded hover:bg-[#fdf2f2] text-[#7f1d1d] transition-colors disabled:opacity-30"
                        title="Quitar archivo del lote"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Visor de Auditoría Forense del archivo seleccionado */}
      {selectedItem && (
        <div className="border-t-2 border-[#b8d8cf]">
          <div className="px-4 py-3 bg-[#f7fbf9] border-b border-[#b8d8cf] flex items-center justify-between">
            <span className="text-xs font-bold text-[#002941]">
              Inspección Forense Detallada: {selectedItem.file.name}
            </span>
            <span className="text-[11px] text-[#335467]">
              {selectedItem.mediaType === 'image' ? 'Formato Imagen' : 'Formato Video'}
            </span>
          </div>
          <ForensicsTable
            report={selectedItem.forensicsReport}
            fileName={selectedItem.file.name}
            processedMode={selectedItem.status === 'done' ? activeMode : null}
          />
        </div>
      )}
    </div>
  );
}
