import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CleanStream Studio | Eliminador de Metadatos C2PA y Anti-SynthID en el Navegador',
  description:
    'Suite profesional de privacidad multimedia 100% client-side impulsada por WebAssembly (FFmpeg.wasm). Elimina contenedores C2PA, XMP, EXIF y firmas esteganográficas invisibles como SynthID sin subir tus videos a ningún servidor.',
  keywords: [
    'CleanStream Studio',
    'C2PA',
    'SynthID',
    'EXIF',
    'XMP',
    'FFmpeg WebAssembly',
    'Privacidad de Video',
    'Limpieza de Metadatos',
  ],
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden">
        <div className="fixed inset-0 -z-10 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.12),rgba(9,9,11,0))]" />
        {children}
      </body>
    </html>
  );
}
