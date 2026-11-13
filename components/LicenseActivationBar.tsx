'use client';

import React, { useState } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { VerifyLicenseResponse } from '@/app/api/verify-license/route';

interface LicenseActivationBarProps {
  currentPlan: 'free' | 'creator' | 'agency';
  onLicenseVerified: (response: VerifyLicenseResponse) => void;
}

export default function LicenseActivationBar({
  currentPlan,
  onLicenseVerified,
}: LicenseActivationBarProps) {
  const [keyInput, setKeyInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setStatusMessage({
        type: 'error',
        text: 'Introduce tu ID de suscripción Paddle (sub_...), transacción (txn_...) o correo de compra.',
      });
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/verify-license', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ licenseKey: trimmed }),
      });

      const data: VerifyLicenseResponse = await res.json();

      if (data.valid && data.plan) {
        setStatusMessage({
          type: 'success',
          text: `Suscripción ${data.plan.toUpperCase()} activada. Todas las funciones correspondientes ya están habilitadas en esta sesión.`,
        });
        onLicenseVerified(data);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'No se pudo validar tu suscripción en Paddle.',
        });
      }
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: `Error de conexión al verificar con Paddle: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="activar-licencia"
      className="bg-[#ffffff] border border-[#b8d8cf] rounded-2xl px-5 py-6 sm:px-8 sm:py-7"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-xl">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-[#335467]">
            <KeyRound className="w-4 h-4 text-[#002941]" />
            <span>Plan activo en esta sesión: {currentPlan.toUpperCase()}</span>
          </div>
          <h4 className="text-lg sm:text-xl font-extrabold text-[#002941] tracking-tight">
            ¿Ya tienes una suscripción en Paddle? Actívala aquí
          </h4>
          <p className="text-xs text-[#335467] leading-relaxed">
            Ingresa tu correo de compra en Paddle, tu ID de suscripción (<code className="font-mono text-[#002941] font-semibold">sub_...</code>) o tu ID de transacción (<code className="font-mono text-[#002941] font-semibold">txn_...</code>).
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto lg:min-w-[430px]"
        >
          <input
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="tu@correo.com, sub_... o txn_..."
            disabled={isLoading}
            className="flex-1 min-h-[48px] rounded-xl border border-[#b8d8cf] bg-[#f7fbf9] px-4 text-xs sm:text-sm font-mono text-[#002941] placeholder:text-[#335467]/55 focus:outline-none focus:border-[#002941] focus:bg-[#ffffff] transition-colors"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="btn-navy min-h-[48px] px-6 text-xs sm:text-sm font-bold shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validando...</span>
              </>
            ) : (
              <span>Activar acceso</span>
            )}
          </button>
        </form>
      </div>

      {statusMessage && (
        <div
          className={`mt-4 px-4 py-3 rounded-xl text-xs font-medium flex items-start gap-2.5 ${
            statusMessage.type === 'success'
              ? 'bg-[#cfe8e1] text-[#002941]'
              : 'bg-[#fdf2f2] text-[#7f1d1d]'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#002941]" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#7f1d1d]" />
          )}
          <span className="leading-relaxed">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
}
