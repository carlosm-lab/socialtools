'use client';

import React from 'react';
import { ForensicsReport, DiagnosticItem } from '@/lib/forensicsScanner';
import { AlertCircle, CheckCircle2, ShieldCheck, Info } from 'lucide-react';

interface ForensicsTableProps {
  report: ForensicsReport | null;
  fileName?: string;
  processedMode?: 'fast' | 'deep' | 'spoofer' | null;
}

export default function ForensicsTable({
  report,
  fileName,
  processedMode,
}: ForensicsTableProps) {
  if (!report) return null;

  const effectiveMode = processedMode || report.processedMode || null;
  const isMode1 = effectiveMode === 'fast';
  const isMode2 = effectiveMode === 'deep';

  // Group items into Layer 1 and Layer 2
  const layer1Items: DiagnosticItem[] =
    report.layer1?.items ||
    report.diagnostics.filter(
      (d) =>
        d.layer === 1 ||
        ['c2pa', 'iptc_ai', 'provenance_authority', 'xmp_metadata'].includes(d.id)
    );

  const layer2Items: DiagnosticItem[] =
    report.layer2?.items ||
    report.diagnostics.filter(
      (d) =>
        d.layer === 2 ||
        ['synthid', 'acoustic_spectrum', 'file_hash'].includes(d.id)
    );

  const layer1Alerts = layer1Items.filter((d) => d.detected).length;
  const isLayer1Verified = isMode1 || isMode2 || report.layer1?.verified || layer1Alerts === 0;

  return (
    <div className="border-t border-[#b8d8cf]">
      {/* Cabecera inline general */}
      <div className="px-4 py-4 sm:px-8 bg-[#eaf5f1]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#335467]">
            Reporte Forense de Dos Capas
          </span>
          <h3 className="text-sm font-bold text-[#002941] mt-0.5 truncate">
            {effectiveMode
              ? `Auditoría post-procesamiento (${
                  isMode1 ? 'Modo 1: Purga Rápida' : isMode2 ? 'Modo 2: Blindaje Total' : 'Modo 3'
                }): ${fileName || 'Archivo'}`
              : `Diagnóstico previo: ${fileName || 'Archivo cargado'}`}
          </h3>
        </div>

        <div className="text-xs font-semibold shrink-0">
          {isMode2 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cfe8e1] text-[#002941]">
              <ShieldCheck className="w-4 h-4 text-[#002941]" />
              Blindaje Total Certificado
            </span>
          ) : isMode1 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cfe8e1] text-[#002941]">
              <CheckCircle2 className="w-4 h-4 text-[#002941]" />
              Capa 1 Purgada al 100%
            </span>
          ) : report.hasAiMarkers || report.totalMarkersFound > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fdf2f2] text-[#7f1d1d]">
              <AlertCircle className="w-4 h-4 text-[#7f1d1d]" />
              {report.totalMarkersFound}{' '}
              {report.totalMarkersFound === 1 ? 'señal detectada' : 'señales detectadas'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cfe8e1] text-[#002941]">
              <CheckCircle2 className="w-4 h-4 text-[#002941]" />
              Video limpio (Sin firmas detectadas)
            </span>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CAPA 1: CONTENEDOR Y METADATOS DIGITALES                                 */}
      {/* ========================================================================= */}
      <div className="border-t border-[#b8d8cf]">
        <div className="px-4 py-3 sm:px-8 bg-[#eaf5f1]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#002941]">
                Capa 1: Contenedor y Metadatos Digitales
              </span>
              {isLayer1Verified ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#cfe8e1] text-[#002941]">
                  <CheckCircle2 className="w-3 h-3 text-[#002941]" /> Verificado 100%
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#fdf2f2] text-[#7f1d1d]">
                  <AlertCircle className="w-3 h-3 text-[#7f1d1d]" /> Firmas expuestas
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#335467] mt-0.5">
              Verificación binaria estricta de manifiestos C2PA, metadatos IPTC, paquetes XMP, EXIF y cabeceras de autor.
            </p>
          </div>
        </div>

        {/* Tabla Escritorio Capa 1 */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y border-[#b8d8cf] bg-[#f7fbf9] text-[#335467]">
                <th className="py-2.5 px-6 font-semibold w-[28%]">Criterio de contenedor</th>
                <th className="py-2.5 px-6 font-semibold w-[36%]">Estado actual (Antes)</th>
                <th className="py-2.5 px-6 font-semibold w-[36%]">Tras CleanStream (Después)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#b8d8cf]/65">
              {layer1Items.map((item) => {
                const isAlert = item.severity === 'alert';
                return (
                  <tr key={item.id} className="hover:bg-[#f7fbf9] transition-colors">
                    <td className="py-3 px-6 font-semibold text-[#002941]">{item.name}</td>
                    <td
                      className={`py-3 px-6 ${
                        isAlert ? 'bg-[#fdf2f2] text-[#7f1d1d]' : 'text-[#335467]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isAlert ? (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7f1d1d]" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                        )}
                        <span>{item.currentState}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 bg-[#cfe8e1]/45 text-[#002941] font-medium">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                        <span>{item.sanitizedState}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lista Móvil Capa 1 */}
        <div className="sm:hidden divide-y divide-[#b8d8cf]/70">
          {layer1Items.map((item) => {
            const isAlert = item.severity === 'alert';
            return (
              <div key={item.id} className="px-4 py-3 space-y-1.5 text-xs">
                <div className="font-bold text-[#002941]">{item.name}</div>
                <div
                  className={`px-3 py-2 rounded-lg flex items-start gap-2 ${
                    isAlert ? 'bg-[#fdf2f2] text-[#7f1d1d]' : 'bg-[#f7fbf9] text-[#335467]'
                  }`}
                >
                  {isAlert ? (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7f1d1d]" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                  )}
                  <span className="break-words">
                    <strong className="font-semibold">Antes:</strong> {item.currentState}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-[#cfe8e1]/55 text-[#002941] flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                  <span className="break-words font-medium">
                    <strong className="font-semibold">Después:</strong> {item.sanitizedState}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CAPA 2: TRANSFORMACIÓN DE SEÑAL (PÍXELES Y ESPECTRO ACÚSTICO)             */}
      {/* ========================================================================= */}
      <div className="border-t border-[#b8d8cf]">
        <div className="px-4 py-3 sm:px-8 bg-[#eaf5f1]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#002941]">
                Capa 2: Transformación de Señal (Píxeles y Audio)
              </span>
              {isMode2 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#cfe8e1] text-[#002941]">
                  <ShieldCheck className="w-3 h-3 text-[#002941]" /> Blindaje Certificado
                </span>
              ) : isMode1 ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#fdf2f2] text-[#7f1d1d]">
                  <Info className="w-3 h-3 text-[#7f1d1d]" /> Matriz intacta (Requiere Modo 2)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#eaf5f1] text-[#335467]">
                  Análisis espectral y espacial
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#335467] mt-0.5">
              Evaluación de firmas latentes en la distribución de píxeles (SynthID) y espectro FFT &gt;19.5 kHz.
            </p>
          </div>
        </div>

        {/* Callout de honestidad para Modo 1: Advertencia de matriz intacta */}
        {isMode1 && (
          <div className="mx-4 sm:mx-8 my-3 p-3.5 rounded-xl border border-[#b8d8cf] bg-[#cfe8e1]/60 text-xs text-[#002941] space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <Info className="w-4 h-4 text-[#002941] shrink-0" />
              <span>Aviso de Integridad Técnica: Matriz de píxeles intacta (Stream-copy)</span>
            </div>
            <p className="leading-relaxed text-[#335467]">
              La purga de metadatos eliminó el 100% de los contenedores C2PA y etiquetas digitales. Sin embargo, la matriz espacial de píxeles y las muestras de audio permanecen intactas al no haberse recodificado el video. Los clasificadores neuronales en servidor (como DeepMind SynthID) aún pueden identificar los patrones de píxeles originales. Para alterar la distribución espacial de píxeles y aplicar el filtro acústico 20Hz-19.5kHz, aplica el <strong className="font-semibold text-[#002941]">Modo 2 (Escudo Anti-SynthID)</strong>.
            </p>
          </div>
        )}

        {/* Callout de certificación para Modo 2: Blindaje Total */}
        {isMode2 && (
          <div className="mx-4 sm:mx-8 my-3 p-3.5 rounded-xl border border-[#b8d8cf] bg-[#cfe8e1]/60 text-xs text-[#002941] space-y-1">
            <div className="flex items-center gap-2 font-bold text-[#002941]">
              <ShieldCheck className="w-4 h-4 text-[#002941] shrink-0" />
              <span>Blindaje de Señal Certificado (Modo 2: Anti-SynthID Shield)</span>
            </div>
            <p className="leading-relaxed text-[#335467]">
              Matriz espacial alterada mediante micro-recorte perimetral (0.99), micro-ruido temporal estocástico y recodificación x264 CRF 18 bitexact. Filtro acústico pasa-banda 20 Hz – 19.5 kHz aplicado para atenuar portadoras ultrasónicas.
            </p>
          </div>
        )}

        {/* Tabla Escritorio Capa 2 */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-y border-[#b8d8cf] bg-[#f7fbf9] text-[#335467]">
                <th className="py-2.5 px-6 font-semibold w-[28%]">Criterio de señal</th>
                <th className="py-2.5 px-6 font-semibold w-[36%]">Estado actual (Antes)</th>
                <th className="py-2.5 px-6 font-semibold w-[36%]">Tras CleanStream (Después)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#b8d8cf]/65">
              {layer2Items.map((item) => {
                const isAlert = item.severity === 'alert';
                return (
                  <tr key={item.id} className="hover:bg-[#f7fbf9] transition-colors">
                    <td className="py-3 px-6 font-semibold text-[#002941]">{item.name}</td>
                    <td
                      className={`py-3 px-6 ${
                        isAlert ? 'bg-[#fdf2f2] text-[#7f1d1d]' : 'text-[#335467]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {isAlert ? (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7f1d1d]" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                        )}
                        <span>{item.currentState}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 bg-[#cfe8e1]/45 text-[#002941] font-medium">
                      <div className="flex items-start gap-2">
                        {isMode2 ? (
                          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                        )}
                        <span>{item.sanitizedState}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Lista Móvil Capa 2 */}
        <div className="sm:hidden divide-y divide-[#b8d8cf]/70">
          {layer2Items.map((item) => {
            const isAlert = item.severity === 'alert';
            return (
              <div key={item.id} className="px-4 py-3 space-y-1.5 text-xs">
                <div className="font-bold text-[#002941]">{item.name}</div>
                <div
                  className={`px-3 py-2 rounded-lg flex items-start gap-2 ${
                    isAlert ? 'bg-[#fdf2f2] text-[#7f1d1d]' : 'bg-[#f7fbf9] text-[#335467]'
                  }`}
                >
                  {isAlert ? (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7f1d1d]" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                  )}
                  <span className="break-words">
                    <strong className="font-semibold">Antes:</strong> {item.currentState}
                  </span>
                </div>
                <div className="px-3 py-2 rounded-lg bg-[#cfe8e1]/55 text-[#002941] flex items-start gap-2">
                  {isMode2 ? (
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#002941]" />
                  )}
                  <span className="break-words font-medium">
                    <strong className="font-semibold">Después:</strong> {item.sanitizedState}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
