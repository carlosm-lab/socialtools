# CleanStream Studio

Aplicación web Full-Stack Client-Side construida con **Next.js 14+ (App Router)**, **TypeScript**, **Tailwind CSS** y **WebAssembly (`@ffmpeg/ffmpeg` y `@ffmpeg/util` v0.12.x)** para eliminar metadatos ocultos (`C2PA`, `XMP`, `EXIF`, `udta`) y romper firmas esteganográficas invisibles (`SynthID` en video y audio) de archivos `MP4`, `MOV` y `WebM` ejecutándose 100% en el navegador.

## Estructura del Proyecto

- `package.json`: Dependencias de producción (`next`, `react`, `react-dom`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`, `lucide-react`).
- `next.config.mjs`: Configuración crítica de cabeceras HTTP (`Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp`) en todas las rutas (`/(.*)`) para habilitar `SharedArrayBuffer` en Vercel y navegadores móviles.
- `app/layout.tsx`: Layout raíz en tema oscuro SaaS minimalista con fuentes `Inter` y `JetBrains Mono`.
- `app/page.tsx`: Página principal que importa `components/VideoCleaner.tsx` de forma dinámica con `{ ssr: false }` para evitar errores de hidratación en el servidor.
- `components/VideoCleaner.tsx`: Componente cliente aislado con carga de `@ffmpeg/core@0.12.6` mediante `toBlobURL`, selector de 2 modos de limpieza, zona Drag & Drop responsiva, barra de progreso real (`ffmpeg.on('progress')`), consola técnica colapsable (`ffmpeg.on('log')`), descarga directa (`clean_video_[timestamp].mp4`) y liberación explícita de memoria RAM (`ffmpeg.deleteFile` y `URL.revokeObjectURL`).

## Despliegue en Vercel

1. Instala las dependencias:
   ```bash
   npm install
   ```
2. Ejecuta el entorno de desarrollo:
   ```bash
   npm run dev
   ```
3. Despliega en Vercel:
   ```bash
   npx vercel --prod
   ```
