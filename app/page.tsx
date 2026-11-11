import dynamic from 'next/dynamic';
import { Shield, Lock, Cpu, Sparkles, CheckCircle2 } from 'lucide-react';

// Carga diferida estrictamente en el cliente (ssr: false) para evitar errores de hidratación
// y referencias a APIs del navegador (WebAssembly, SharedArrayBuffer, Blob, Worker) en el servidor.
const VideoCleaner = dynamic(() => import('@/components/VideoCleaner'), {
  ssr: false,
  loading: () => (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-zinc-800/80 bg-zinc-900/50 p-8 sm:p-12 backdrop-blur-xl animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className="h-6 w-48 rounded-md bg-zinc-800" />
        <div className="h-7 w-36 rounded-full bg-zinc-800" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="h-32 rounded-xl bg-zinc-800/70" />
        <div className="h-32 rounded-xl bg-zinc-800/70" />
      </div>
      <div className="h-64 rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/40 flex flex-col items-center justify-center gap-3">
        <div className="h-12 w-12 rounded-full bg-zinc-800" />
        <div className="h-4 w-56 rounded bg-zinc-800" />
        <div className="h-3 w-40 rounded bg-zinc-800/60" />
      </div>
    </div>
  ),
});

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Barra de Navegación Superior */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-inner shadow-emerald-500/10">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold tracking-tight text-zinc-100 text-base sm:text-lg">
                  CleanStream Studio
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  WASM v0.12
                </span>
              </div>
              <p className="text-xs text-zinc-400 hidden sm:block">
                Sanitización Multimedia C2PA &amp; Anti-SynthID en el Navegador
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-full">
              <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>100% Local · 0 Bytes Subidos</span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Encabezado Hero */}
        <section className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 mb-4">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Procesamiento en Dispositivo Compatible con iOS, Android y Escritorio</span>
          </div>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-50 mb-3 sm:mb-4">
            Elimina Metadatos Ocultos y{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Firmas Esteganográficas
            </span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
            Destruye contenedores binarios <strong className="text-zinc-200 font-medium">C2PA (JUMBF)</strong>,{' '}
            <strong className="text-zinc-200 font-medium">XMP</strong>,{' '}
            <strong className="text-zinc-200 font-medium">EXIF</strong> y{' '}
            <strong className="text-zinc-200 font-medium">udta</strong>, o aplica perturbación matemática de
            luminancia temporal y filtrado espectral acústico para neutralizar marcas invisibles como{' '}
            <strong className="text-zinc-200 font-medium">SynthID</strong> directamente en la memoria RAM de tu
            dispositivo.
          </p>
        </section>

        {/* Componente Cliente Aislado */}
        <VideoCleaner />

        {/* Tarjetas Informativas de Arquitectura */}
        <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2.5 text-zinc-100 font-medium text-sm mb-2">
              <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Aislamiento WebAssembly Puro</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Ejecuta <code className="text-zinc-300 font-mono">@ffmpeg/core@0.12.6</code> mediante{' '}
              <code className="text-zinc-300 font-mono">SharedArrayBuffer</code> y{' '}
              <code className="text-zinc-300 font-mono">toBlobURL</code>. Tus archivos nunca abandonan tu
              teléfono ni tu computadora.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2.5 text-zinc-100 font-medium text-sm mb-2">
              <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Purga de Manifiestos C2PA y XMP</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              El modo ultra-rápido remueve átomos propietarios, tablas de procedencia criptográfica y cadenas de
              historial de software usando <code className="text-zinc-300 font-mono">-map_metadata -1</code> y{' '}
              <code className="text-zinc-300 font-mono">+bitexact</code>.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5">
            <div className="flex items-center gap-2.5 text-zinc-100 font-medium text-sm mb-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
              <span>Disrupción Espectral y Espacial</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              El modo profundo desalinea mallas esteganográficas con micro-recorte del 1%, ruido temporal de
              luminancia (<code className="text-zinc-300 font-mono">alls=1:allf=t</code>) y recorte acústico
              20Hz–19.5kHz.
            </p>
          </div>
        </section>
      </main>

      {/* Pie de Página */}
      <footer className="border-t border-zinc-900 bg-zinc-950/90 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>CleanStream Studio · Arquitectura Client-Side Next.js 14 + FFmpeg.wasm</p>
          <p className="font-mono text-[11px] text-zinc-400">
            COOP: same-origin | COEP: require-corp | SharedArrayBuffer Ready
          </p>
        </div>
      </footer>
    </div>
  );
}
