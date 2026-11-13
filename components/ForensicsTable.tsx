'use client';

import React from 'react';
import { ForensicsReport } from '@/lib/forensicsScanner';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ForensicsTableProps {
  report: ForensicsReport | null;
  fileName?: string;
}

export default function ForensicsTable({ report, fileName }: ForensicsTableProps) {
  if (!report) return null;

  return (
    <div className="border-t border-[#b8d8cf]">
      {/* Cabecera inline sobre el bloque blanco */}
      <div className="px-4 py-4 sm:px-8 bg-[#eaf5f1]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#335467]">
            Escáner Forense en Memoria
          </span>
          <h3 className="text-sm font-bold text-[#002941] mt-0.5 truncate">
            Diagnóstico previo: {fileName || 'Archivo cargado'}
          </h3>
        </div>

        <div className="text-xs font-semibold shrink-0">
          {report.hasAiMarkers || report.totalMarkersFound > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-[#7f1d1d]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {report.totalMarkersFound}{' '}
              {report.totalMarkersFound === 1 ? 'señal detectada' : 'señales detectadas'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[#002941]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Video 100% limpio (Sin firmas de IA)
            </span>
          )}
        </div>
      </div>

      {/* VISTA MÓVIL (<640px): Lista limpia separada por divisores de 1px sin tarjetas internas */}
      <div className="sm:hidden divide-y divide-[#b8d8cf]/70">
        {report.diagnostics.map((item) => {
          const isAlert = item.severity === 'alert';
          return (
            <div key={item.id} className="px-4 py-3.5 space-y-1.5 text-xs">
              <div className="font-bold text-[#002941]">{item.name}</div>
              <div
                className={`px-3 py-2 rounded-lg flex items-start gap-2 ${
                  isAlert ? 'bg-[#fdf2f2] text-[#7f1d1d]' : 'bg-[#f7fbf9] text-[#335467]'
                }`}
              >
                {isAlert && (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7f1d1d]" />
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

      {/* VISTA ESCRITORIO (>=640px): Tabla comparativa limpia */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-y border-[#b8d8cf] bg-[#eaf5f1]/40 text-[#335467]">
              <th className="py-3 px-6 font-semibold w-[28%]">Criterio analizado</th>
              <th className="py-3 px-6 font-semibold w-[36%]">Estado actual (Antes)</th>
              <th className="py-3 px-6 font-semibold w-[36%]">Tras CleanStream (Después)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#b8d8cf]/65">
            {report.diagnostics.map((item) => {
              const isAlert = item.severity === 'alert';
              return (
                <tr key={item.id} className="hover:bg-[#f7fbf9] transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-[#002941]">{item.name}</td>
                  <td
                    className={`py-3.5 px-6 ${
                      isAlert ? 'bg-[#fdf2f2] text-[#7f1d1d]' : 'text-[#335467]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {isAlert && (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#7f1d1d]" />
                      )}
                      <span>{item.currentState}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-6 bg-[#cfe8e1]/45 text-[#002941] font-medium">
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
    </div>
  );
}
