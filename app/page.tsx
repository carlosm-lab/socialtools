'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Play,
  Download,
  RotateCcw,
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Terminal,
  RefreshCw,
  Menu,
  X,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { useFFmpegCleaner } from '@/components/useFFmpegCleaner';
import ModeSelector, { ProcessingMode } from '@/components/ModeSelector';
import ForensicsTable from '@/components/ForensicsTable';
import PricingTable from '@/components/PricingTable';
import LicenseActivationBar from '@/components/LicenseActivationBar';
import { VerifyLicenseResponse } from '@/app/api/verify-license/route';

export default function HomePage() {
  const [activeMode, setActiveMode] = useState<ProcessingMode>('fast');
  const [variantCount, setVariantCount] = useState<3 | 5 | 10>(3);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const [userPlan, setUserPlan] = useState<'free' | 'creator' | 'agency'>('free');
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    name: string;
    picture?: string;
    role: 'user' | 'admin';
    plan: 'free' | 'creator' | 'agency' | 'unlimited';
    credits: number;
    isAdmin: boolean;
  } | null>(null);
  const [userCredits, setUserCredits] = useState<number>(0);
  const [licenseFeatures, setLicenseFeatures] = useState<{
    unlimitedDuration?: boolean;
    modeDeepAntiSynthID?: boolean;
    modeMultiVariant?: boolean;
  }>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    engineStatus,
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
  } = useFFmpegCleaner();

  const handleLicenseVerified = (data: VerifyLicenseResponse) => {
    if (data.valid && data.plan) {
      setUserPlan(data.plan);
      setLicenseFeatures(data.features || {});
    }
  };

  // Hidratar sesión de usuario y créditos desde /api/auth/me
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data.user) {
          setCurrentUser(data.user);
          setUserCredits(data.user.credits);
          if (data.user.plan === 'unlimited' || data.user.isAdmin) {
            setUserPlan('agency');
            setLicenseFeatures({
              unlimitedDuration: true,
              modeDeepAntiSynthID: true,
              modeMultiVariant: true,
            });
          } else if (data.user.plan === 'agency') {
            setUserPlan('agency');
            setLicenseFeatures({
              unlimitedDuration: true,
              modeDeepAntiSynthID: true,
              modeMultiVariant: true,
            });
          } else if (data.user.plan === 'creator') {
            setUserPlan('creator');
            setLicenseFeatures({
              unlimitedDuration: true,
              modeDeepAntiSynthID: true,
              modeMultiVariant: false,
            });
          }
        }
      })
      .catch((err) => {
        console.error('[Session Hydration] Error:', err);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { }
    setCurrentUser(null);
    setUserPlan('free');
    setUserCredits(0);
    setLicenseFeatures({});
  };

  // Auto-validar si el usuario regresa desde /checkout con ?txn_id=txn_...
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const txnId = params.get('txn_id');
    if (!txnId) return;

    fetch('/api/verify-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: txnId }),
    })
      .then((res) => res.json())
      .then((data: VerifyLicenseResponse) => {
        if (data.valid && data.plan) {
          setUserPlan(data.plan);
          setLicenseFeatures(data.features || {});
        }
      })
      .catch(() => {
        // El usuario siempre puede activar manualmente en #activar-licencia
      });
  }, []);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(file.name)) {
        await selectFile(file);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isProcessing) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await selectFile(files[0]);
    }
    e.target.value = '';
  };

  const handleExecute = async () => {
    if (!currentUser) {
      window.location.href = '/api/auth/google?return_to=' + encodeURIComponent(window.location.pathname);
      return;
    }

    if (!currentUser.isAdmin && currentUser.plan === 'free' && userCredits < 1) {
      const planesElem = document.getElementById('planes');
      planesElem?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    try {
      const consumeRes = await fetch('/api/credits/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: activeMode,
          fileName: selectedFile?.name,
          videoDuration: fileDuration,
        }),
      });

      const consumeData = await consumeRes.json();
      if (!consumeRes.ok || !consumeData.success) {
        const planesElem = document.getElementById('planes');
        planesElem?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      if (typeof consumeData.credits === 'number') {
        setUserCredits(consumeData.credits);
        setCurrentUser((prev) => (prev ? { ...prev, credits: consumeData.credits } : null));
      }
    } catch (err) {
      console.error('[Credit Consume] Error:', err);
    }

    await executeClean(activeMode, variantCount, licenseFeatures);
  };

  const handleDownloadAllVariants = () => {
    for (const v of variantResults) {
      const a = document.createElement('a');
      a.href = v.blobUrl;
      a.download = v.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(label);
    setTimeout(() => {
      setCopiedHash(null);
    }, 2000);
  };

  const stepIndex =
    currentStep === 'scanning'
      ? 1
      : currentStep === 'stripping'
        ? 2
        : currentStep === 'shielding' || currentStep === 'variants'
          ? 3
          : currentStep === 'completed'
            ? 4
            : 0;

  return (
    <div className="min-h-screen bg-[#cfe8e1] text-[#002941] flex flex-col justify-between overflow-x-hidden">
      {/* 1. Navegación limpia y uniforme directamente sobre Pale Mint (#cfe8e1) */}
      <header className="border-b border-[#b8d8cf]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-2 sm:gap-4">
          <a href="#" className="flex items-center gap-1.5 sm:gap-2 select-none min-h-[44px] shrink-0">
            <span className="text-base sm:text-xl font-extrabold tracking-tight text-[#002941]">
              CleanStream
            </span>
            <Zap className="w-4 h-4 text-[#002941] fill-current shrink-0" />
            <span className="hidden sm:inline text-xs font-semibold text-[#335467]">Studio</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-[#002941]">
            <a href="#estudio" className="min-h-[44px] flex items-center hover:opacity-70">
              Estudio
            </a>
            <a href="#planes" className="min-h-[44px] flex items-center hover:opacity-70">
              Planes
            </a>
            <a
              href="#activar-licencia"
              className="min-h-[44px] flex items-center hover:opacity-70"
            >
              Activar licencia
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            {currentUser ? (
              <div className="flex items-center gap-2">
                {currentUser.picture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.picture}
                    alt={currentUser.name}
                    className="w-7 h-7 rounded-lg border border-[#b8d8cf] object-cover"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg border border-[#b8d8cf] bg-[#002941] text-[#cfe8e1] font-bold text-xs flex items-center justify-center">
                    {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="font-bold text-[#002941] leading-tight text-[11px] truncate max-w-[120px]">
                    {currentUser.name || currentUser.email}
                  </span>
                  <span className="text-[10px] text-[#335467] font-semibold">
                    {currentUser.isAdmin || currentUser.plan === 'unlimited'
                      ? 'Plan Ilimitado (Admin)'
                      : currentUser.plan === 'agency'
                        ? 'Plan Agencia'
                        : currentUser.plan === 'creator'
                          ? 'Plan Creador'
                          : `${userCredits} crédito${userCredits === 1 ? '' : 's'}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="min-h-[44px] px-2.5 rounded-xl text-xs font-semibold text-[#7f1d1d] hover:bg-[#fdf2f2] transition-colors"
                >
                  Salir
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/google"
                className="min-h-[44px] px-3.5 rounded-xl border border-[#b8d8cf] bg-[#ffffff] text-[#002941] font-bold text-xs inline-flex items-center gap-2 hover:bg-[#eaf5f1] transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="whitespace-nowrap">
                  Acceder<span className="hidden sm:inline"> (1 crédito gratis)</span>
                </span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
              className="md:hidden w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl border border-[#b8d8cf] bg-[#ffffff] text-[#002941] flex items-center justify-center transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Menú móvil desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#ffffff] border-t border-[#b8d8cf] px-4 py-3 space-y-1">
            <a
              href="#estudio"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] px-3 rounded-lg flex items-center text-sm font-bold text-[#002941] hover:bg-[#eaf5f1]"
            >
              Estudio de Sanitización
            </a>
            <a
              href="#planes"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] px-3 rounded-lg flex items-center text-sm font-bold text-[#002941] hover:bg-[#eaf5f1]"
            >
              Planes y Precios
            </a>
            <a
              href="#activar-licencia"
              onClick={() => setMobileMenuOpen(false)}
              className="min-h-[44px] px-3 rounded-lg flex items-center text-sm font-bold text-[#002941] hover:bg-[#eaf5f1]"
            >
              Activar Licencia ({userPlan.toUpperCase()})
            </a>
            {currentUser ? (
              <div className="pt-2 border-t border-[#b8d8cf] px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#002941] truncate max-w-[180px]">
                    {currentUser.name || currentUser.email}
                  </p>
                  <p className="text-[11px] text-[#335467] font-semibold">
                    {currentUser.isAdmin || currentUser.plan === 'unlimited'
                      ? 'Plan Ilimitado (Admin)'
                      : `${userCredits} crédito${userCredits === 1 ? '' : 's'}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs font-semibold text-[#7f1d1d] px-2 py-1"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <a
                href="/api/auth/google"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] px-3 rounded-lg flex items-center text-sm font-bold text-[#002941] hover:bg-[#eaf5f1]"
              >
                Iniciar sesión con Google (1 crédito gratis)
              </a>
            )}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-16 flex-1 w-full space-y-10 sm:space-y-12">
        {/* 2. Hero limpio directamente sobre el fondo uniforme Pale Mint (#cfe8e1) */}
        <section className="space-y-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#335467]">
              socialtools.click · Para Creadores y Agencias UGC
            </p>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#002941] tracking-tight leading-[1.08]">
              Publica videos de IA sin etiquetas ni rastros ocultos.
            </h1>
            <p className="text-sm sm:text-base text-[#002941]/85 leading-relaxed max-w-2xl">
              Elimina manifiestos C2PA, huellas SynthID y metadatos duplicados de Veo 3.1, Sora, Runway o HeyGen antes de publicar en TikTok, Reels o Shorts — 100% en tu dispositivo, sin subir tus archivos a ningún servidor.
            </p>
          </div>

          {/* Métricas horizontales con divisores finos directamente sobre #cfe8e1 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 border-y border-[#002941]/15 sm:divide-x divide-[#002941]/15 py-4 gap-4 sm:gap-0">
            <div className="sm:pr-5">
              <div className="text-base sm:text-lg font-extrabold text-[#002941]">0 Bytes</div>
              <div className="text-xs text-[#335467]">Subidos a servidores</div>
            </div>
            <div className="sm:px-5">
              <div className="text-base sm:text-lg font-extrabold text-[#002941]">~1 Segundo</div>
              <div className="text-xs text-[#335467]">Purga C2PA y EXIF</div>
            </div>
            <div className="sm:px-5">
              <div className="text-base sm:text-lg font-extrabold text-[#002941]">Anti-SynthID</div>
              <div className="text-xs text-[#335467]">Escudo visual y audio</div>
            </div>
            <div className="sm:pl-5">
              <div className="text-base sm:text-lg font-extrabold text-[#002941]">Hasta 10x</div>
              <div className="text-xs text-[#335467]">Copias con hash único</div>
            </div>
          </div>
        </section>

        {/* 3. BLOQUE PRINCIPAL BLANCO (#ffffff) DEL ESTUDIO (sin tarjetas dentro de tarjetas ni píldoras) */}
        <section
          id="estudio"
          className="bg-[#ffffff] border border-[#b8d8cf] rounded-2xl overflow-hidden"
        >
          {/* Selector de Modos */}
          <div className="p-4 sm:p-7">
            <ModeSelector
              activeMode={activeMode}
              onChangeMode={setActiveMode}
              variantCount={variantCount}
              onChangeVariantCount={setVariantCount}
              userPlan={userPlan}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Zona de Carga o Archivo Seleccionado */}
          <div className="border-t border-[#b8d8cf]">
            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`px-4 py-12 sm:px-8 sm:py-16 text-center cursor-pointer transition-colors ${isDragging ? 'bg-[#cfe8e1]/45' : 'hover:bg-[#eaf5f1]/60'
                  }`}
              >
                <div className="w-12 h-12 rounded-xl bg-[#002941] text-[#cfe8e1] flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <h2 className="text-base sm:text-lg font-extrabold text-[#002941]">
                  Toca para elegir un video o arrástralo aquí
                </h2>
                <p className="text-xs sm:text-sm text-[#335467] mt-1.5 max-w-md mx-auto">
                  MP4, MOV o WebM · Hasta 20s gratis en Modo 1 · Procesamiento 100% en tu dispositivo
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="btn-navy w-full sm:w-auto text-xs sm:text-sm"
                  >
                    <Upload className="w-4 h-4 text-[#cfe8e1]" />
                    <span>Seleccionar video del dispositivo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-5 sm:px-8 sm:py-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-[#002941] text-[#cfe8e1] flex items-center justify-center shrink-0">
                      <FileVideo className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm sm:text-base font-bold text-[#002941] truncate">
                        {selectedFile.name}
                      </div>
                      <div className="text-xs text-[#335467] mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                        {fileDuration !== null && fileDuration > 0 && (
                          <span>· {fileDuration.toFixed(1)}s</span>
                        )}
                        <span>· En memoria local</span>
                      </div>
                    </div>
                  </div>

                  {/* Botones táctiles >= 44px/48px */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <div className="grid grid-cols-2 sm:flex gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className="btn-outline-navy text-xs"
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={clearFile}
                        disabled={isProcessing}
                        className="min-h-[44px] min-w-[44px] px-4 rounded-xl text-xs font-semibold text-[#7f1d1d] bg-[#fdf2f2] hover:bg-[#7f1d1d] hover:text-white transition-colors disabled:opacity-50"
                      >
                        Quitar
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleExecute}
                      disabled={isProcessing || isScanning}
                      className="btn-navy w-full sm:w-auto text-xs sm:text-sm"
                    >
                      {isProcessing ? (
                        <>
                          <RotateCcw className="w-4 h-4 animate-spin text-[#cfe8e1]" />
                          <span>Procesando ({progressPercent}%)...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current text-[#cfe8e1]" />
                          <span>
                            {activeMode === 'fast'
                              ? 'Limpiar Metadatos Gratis'
                              : activeMode === 'deep'
                                ? 'Aplicar Escudo Anti-SynthID'
                                : `Generar ${variantCount} Variantes Únicas`}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {originalPreviewUrl && !singleResult && variantResults.length === 0 && (
                  <div className="flex justify-center">
                    <video
                      src={originalPreviewUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-[280px] w-auto max-w-full rounded-xl bg-[#001d2e]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mensaje de error */}
          {processError && (
            <div className="border-t border-[#b8d8cf] px-4 py-4 sm:px-8 bg-[#fdf2f2] text-xs text-[#7f1d1d] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{processError}</span>
            </div>
          )}

          {/* Indicador de progreso lineal con pasos en lenguaje humano */}
          {(isProcessing || currentStep === 'completed') && (
            <div className="border-t border-[#b8d8cf] px-4 py-5 sm:px-8 bg-[#eaf5f1]/60 space-y-3.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#002941]">{stepMessage}</span>
                <span className="font-mono font-bold text-[#002941] shrink-0">
                  {progressPercent}%
                </span>
              </div>

              <div className="w-full h-2 rounded-lg bg-[#cfe8e1] overflow-hidden">
                <div
                  className="h-full bg-[#002941] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {[
                  { idx: 1, label: '1. Escaneando firmas ocultas' },
                  { idx: 2, label: '2. Limpiando manifiesto C2PA' },
                  {
                    idx: 3,
                    label:
                      activeMode === 'spoofer'
                        ? '3. Generando copias únicas'
                        : '3. Aplicando escudo Anti-SynthID',
                  },
                  { idx: 4, label: '4. Listo para descargar' },
                ].map((step) => {
                  const active = stepIndex === step.idx;
                  const passed = stepIndex > step.idx;
                  return (
                    <div
                      key={step.idx}
                      className={`py-2 px-3 rounded-lg font-semibold transition-colors ${active
                          ? 'bg-[#002941] text-white'
                          : passed
                            ? 'bg-[#cfe8e1] text-[#002941]'
                            : 'text-[#335467]'
                        }`}
                    >
                      {step.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tabla Forense Comparativa (Antes vs Después) */}
          {selectedFile && (
            <ForensicsTable report={forensicsReport} fileName={selectedFile.name} />
          )}

          {/* Resultado Modo 1 / Modo 2 */}
          {singleResult && (
            <div className="border-t border-[#b8d8cf] px-4 py-6 sm:px-8 bg-[#eaf5f1]/50 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#002941] shrink-0" />
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#002941]">
                      Video sanitizado en {processingTimeSec}s
                    </h3>
                    <p className="text-xs text-[#335467]">
                      {(singleResult.fileSize / (1024 * 1024)).toFixed(2)} MB · Listo para publicar
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={clearFile}
                    className="btn-outline-navy min-h-[48px] text-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Procesar otro</span>
                  </button>
                  <a
                    href={singleResult.blobUrl}
                    download={singleResult.fileName}
                    className="btn-navy min-h-[48px] text-xs sm:text-sm"
                  >
                    <Download className="w-4 h-4 text-[#cfe8e1]" />
                    <span>Descargar video limpio</span>
                  </a>
                </div>
              </div>

              <div className="flex justify-center">
                <video
                  src={singleResult.blobUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[300px] w-auto max-w-full rounded-xl bg-[#001d2e]"
                />
              </div>

              <div className="divide-y md:divide-y-0 md:divide-x divide-[#b8d8cf] border-t border-[#b8d8cf] pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-0 text-xs">
                <div className="md:pr-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[#335467] block font-semibold text-[11px] uppercase tracking-wider">
                      Nueva huella SHA-256
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#002941] break-all">
                      {singleResult.sha256}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(singleResult.sha256, 'sha256')}
                    title="Copiar SHA-256"
                    className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg border border-[#b8d8cf] bg-[#ffffff] flex items-center justify-center hover:bg-[#cfe8e1] shrink-0 text-[#002941]"
                  >
                    {copiedHash === 'sha256' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="pt-3 md:pt-0 md:pl-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[#335467] block font-semibold text-[11px] uppercase tracking-wider">
                      Nueva huella MD5
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#002941] break-all">
                      {singleResult.md5}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(singleResult.md5, 'md5')}
                    title="Copiar MD5"
                    className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-lg border border-[#b8d8cf] bg-[#ffffff] flex items-center justify-center hover:bg-[#cfe8e1] shrink-0 text-[#002941]"
                  >
                    {copiedHash === 'md5' ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Resultado Modo 3 (Multi-Variant Spoofer) */}
          {variantResults.length > 0 && (
            <div className="border-t border-[#b8d8cf] bg-[#eaf5f1]/50">
              <div className="px-4 py-5 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#b8d8cf]">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-[#002941] shrink-0" />
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#002941]">
                      {variantResults.length} copias únicas generadas en {processingTimeSec}s
                    </h3>
                    <p className="text-xs text-[#335467]">
                      Cada variante posee micro-crop, luminancia y hash SHA-256/MD5 independientes.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <button
                    type="button"
                    onClick={clearFile}
                    className="btn-outline-navy min-h-[48px] text-xs"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Procesar otro</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAllVariants}
                    className="btn-navy min-h-[48px] text-xs sm:text-sm"
                  >
                    <Download className="w-4 h-4 text-[#cfe8e1]" />
                    <span>Descargar todas ({variantResults.length})</span>
                  </button>
                </div>
              </div>

              {/* Lista móvil */}
              <div className="sm:hidden divide-y divide-[#b8d8cf]/70">
                {variantResults.map((v) => (
                  <div key={v.variantIndex} className="px-4 py-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-[#002941]">
                      <span>Variante {v.variantIndex}</span>
                      <span className="font-mono text-[11px] text-[#335467]">
                        {v.cropFactor}x micro-crop
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-[#335467] space-y-0.5">
                      <div className="truncate">
                        SHA-256: <strong className="text-[#002941]">{v.sha256}</strong>
                      </div>
                      <div className="truncate">
                        MD5: <strong className="text-[#002941]">{v.md5}</strong>
                      </div>
                    </div>
                    <a
                      href={v.blobUrl}
                      download={v.fileName}
                      className="btn-navy w-full min-h-[48px] text-xs"
                    >
                      <Download className="w-4 h-4 text-[#cfe8e1]" />
                      <span>Descargar Variante {v.variantIndex}</span>
                    </a>
                  </div>
                ))}
              </div>

              {/* Tabla escritorio */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#b8d8cf] text-[#335467] bg-[#eaf5f1]">
                      <th className="py-3 px-6 font-semibold">Copia</th>
                      <th className="py-3 px-6 font-semibold">Micro-crop</th>
                      <th className="py-3 px-6 font-semibold">SHA-256</th>
                      <th className="py-3 px-6 font-semibold">MD5</th>
                      <th className="py-3 px-6 font-semibold text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#b8d8cf]/65 font-mono">
                    {variantResults.map((v) => (
                      <tr key={v.variantIndex} className="hover:bg-[#ffffff] transition-colors">
                        <td className="py-3.5 px-6 font-sans font-bold text-[#002941]">
                          Variante {v.variantIndex}
                        </td>
                        <td className="py-3.5 px-6 text-[#335467]">{v.cropFactor}x</td>
                        <td className="py-3.5 px-6 text-[#002941] text-[11px]">
                          {v.sha256.slice(0, 14)}…{v.sha256.slice(-8)}
                        </td>
                        <td className="py-3.5 px-6 text-[#002941] text-[11px]">{v.md5}</td>
                        <td className="py-3.5 px-6 text-right font-sans">
                          <a
                            href={v.blobUrl}
                            download={v.fileName}
                            className="btn-navy min-h-[44px] px-4 py-2 text-xs"
                          >
                            <Download className="w-3.5 h-3.5 text-[#cfe8e1]" />
                            <span>Descargar</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Registro técnico discreto colapsado por defecto */}
          <div className="border-t border-[#b8d8cf] px-4 py-3 sm:px-8 bg-[#f7fbf9]">
            <details className="group">
              <summary className="min-h-[44px] text-xs font-semibold text-[#335467] hover:text-[#002941] cursor-pointer flex items-center justify-between gap-2 select-none list-none">
                <span className="inline-flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#002941] shrink-0" />
                  <span>Ver registro técnico de esta sesión (solo en tu dispositivo)</span>
                </span>
                <span className="font-mono text-[11px] text-[#335467] shrink-0">
                  {sessionLogs.length} eventos
                </span>
              </summary>

              <div className="mt-2 pt-3 border-t border-[#b8d8cf] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#335467]">
                  <span>
                    Memoria RAM efímera por sesión; se elimina automáticamente al cambiar de archivo o cerrar esta pestaña.
                  </span>
                  <button
                    type="button"
                    onClick={clearSessionLogs}
                    className="min-h-[44px] px-3 rounded-lg inline-flex items-center gap-1.5 font-bold text-[#7f1d1d] hover:bg-[#fdf2f2] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpiar registro</span>
                  </button>
                </div>

                <div className="rounded-xl bg-[#001d2e] text-[#cfe8e1] p-3.5 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                  {sessionLogs.length === 0 ? (
                    <div className="text-[#cfe8e1]/60">Registro vacío en esta sesión.</div>
                  ) : (
                    sessionLogs.map((log) => (
                      <div key={log.id} className="leading-relaxed flex gap-2">
                        <span className="text-[#cfe8e1]/50 shrink-0">[{log.timestamp}]</span>
                        <span
                          className={
                            log.type === 'error'
                              ? 'text-[#fdf2f2] font-semibold'
                              : log.type === 'warn'
                                ? 'text-[#cfe8e1] font-semibold'
                                : 'text-[#eaf5f1]'
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </details>
          </div>
        </section>

        {/* 4. PLANES Y COMPARATIVA */}
        <section id="planes">
          <PricingTable currentUser={currentUser} />
        </section>

        {/* 5. ACTIVACIÓN DE LICENCIA */}
        <section>
          <LicenseActivationBar
            currentPlan={userPlan}
            onLicenseVerified={handleLicenseVerified}
          />
        </section>
      </main>

      {/* 6. FOOTER LIMPIO CON ENLACES LEGALES REQUERIDOS POR PADDLE */}
      <footer className="border-t border-[#b8d8cf] bg-[#ffffff] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#335467]">
          <div className="text-center sm:text-left">
            <strong className="font-bold text-[#002941]">SocialTools</strong> · carlosm-lab ·{' '}
            <a href="mailto:negocios.axkarl@gmail.com" className="hover:underline font-medium">
              negocios.axkarl@gmail.com
            </a>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-5 font-medium text-[#002941]">
            <a href="/legal" className="hover:underline min-h-[44px] inline-flex items-center">
              Legal Hub
            </a>
            <a href="/legal/terminos" className="hover:underline min-h-[44px] inline-flex items-center">
              Términos
            </a>
            <a href="/legal/privacidad" className="hover:underline min-h-[44px] inline-flex items-center">
              Privacidad
            </a>
            <a href="/legal/reembolsos" className="hover:underline min-h-[44px] inline-flex items-center">
              No Reembolso
            </a>
            <a href="/legal/aviso-legal" className="hover:underline min-h-[44px] inline-flex items-center">
              Aviso Legal
            </a>
            <a href="/legal/cookies" className="hover:underline min-h-[44px] inline-flex items-center">
              Cookies
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
