import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.socialtools.click'),
  title: 'SocialTools · CleanStream Studio — Elimina Marcas de IA C2PA y SynthID en tu Navegador',
  description:
    'Limpia metadatos C2PA, etiquetas EXIF/XMP y firmas esteganográficas SynthID de Veo 3.1, Sora y Runway 100% en tu navegador sin subir archivos a ningún servidor.',
  keywords: [
    'SocialTools',
    'CleanStream Studio',
    'C2PA',
    'SynthID',
    'EXIF',
    'XMP',
    'FFmpeg WebAssembly',
    'UGC Agency',
    'TikTok Reels Shorts',
  ],
};

export const viewport: Viewport = {
  themeColor: '#002941',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${jakarta.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-[#cfe8e1] text-[#002941] font-sans antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
