'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, ArrowLeft, Calendar, Clock } from 'lucide-react';
import { Breadcrumb } from '@/components/legal/Breadcrumb';

export interface LegalArticleReaderProps {
  title: string;
  category?: string;
  date: string;
  readingTime: number;
  children: React.ReactNode;
}

export default function LegalArticleReader({
  title,
  category = 'DOCUMENTACIÓN LEGAL',
  date,
  readingTime,
  children,
}: LegalArticleReaderProps) {
  const router = useRouter();

  const handleClose = useCallback(() => {
    try {
      sessionStorage.setItem('socialtools_legal_return', '1');
    } catch {
      // private browsing fallback
    }
    router.push('/legal');
  }, [router]);

  /* Desktop ESC key listener */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  const breadcrumbItems = [
    { label: 'Inicio', href: '/' },
    { label: 'Legal', href: '/legal' },
    { label: title },
  ];

  /* ════════════════════════════════════════════════════════════════════════
     1. MOBILE / TABLET LAYOUT (< lg)
     Direct in-page document flow on uniform Pale Mint (#cfe8e1) canvas.
     ════════════════════════════════════════════════════════════════════════ */
  const mobileLayout = (
    <div className="lg:hidden w-full bg-[#cfe8e1] min-h-screen">
      <article
        itemScope
        itemType="https://schema.org/Article"
        className="mx-auto max-w-3xl px-4 pt-6 pb-20 sm:px-6"
      >
        <Breadcrumb items={breadcrumbItems} className="mb-6 justify-start" />

        {/* Paper card container (Solid clean white, ZERO nested cards) */}
        <div className="bg-[#ffffff] border border-[#b8d8cf] rounded-2xl p-6 sm:p-10 shadow-sm">
          <header className="mb-8 border-b border-[#b8d8cf] pb-6 text-center">
            {/* Category label (plain editorial text, no badge) */}
            <span
              itemProp="articleSection"
              className="mb-3 inline-block text-[11px] font-bold tracking-[0.18em] text-[#335467] uppercase"
            >
              {category}
            </span>

            <h1
              itemProp="headline"
              className="mb-4 text-2xl leading-tight font-extrabold text-[#002941] sm:text-3xl"
            >
              {title}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#335467]">
              <time
                dateTime="2026-11-11"
                itemProp="datePublished"
                className="flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-[#335467]" />
                {date}
              </time>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#335467]" />
                {readingTime} min de lectura
              </span>
            </div>
          </header>

          {/* Semantic Body */}
          <div
            itemProp="articleBody"
            className="space-y-6 text-[#335467] leading-relaxed"
          >
            {children}
          </div>

          <footer className="mt-10 pt-6 border-t border-[#b8d8cf] flex justify-between items-center">
            <Link
              href="/legal"
              className="btn-outline-navy min-h-[44px] text-xs font-bold inline-flex items-center gap-2 px-4 py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a documentos legales</span>
            </Link>
          </footer>
        </div>
      </article>
    </div>
  );

  /* ════════════════════════════════════════════════════════════════════════
     2. DESKTOP MODAL OVERLAY (lg+)
     Solid Midnight Navy overlay with clean white paper dialog.
     Zero gradients, zero glassmorphism, zero pill badges.
     ════════════════════════════════════════════════════════════════════════ */
  const desktopLayout = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[9999] hidden items-center justify-center overflow-hidden lg:flex"
      style={{
        backgroundColor: 'rgba(0, 41, 65, 0.85)', // Solid Midnight Navy 85%
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Paper dialog container (max-w-[850px], max-h-[96vh], ZERO nested cards) */}
      <div
        className="mx-4 w-full bg-[#ffffff] border border-[#b8d8cf] rounded-2xl flex flex-col shadow-2xl relative overflow-hidden"
        style={{
          maxWidth: 850,
          maxHeight: '96vh',
        }}
      >
        {/* Fixed Close Button (rounded-xl, NOT rounded-full pill) */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar documento y volver al índice legal"
          className="absolute top-5 right-5 z-20 h-11 w-11 flex items-center justify-center rounded-xl border border-[#b8d8cf] bg-[#ffffff] text-[#002941] hover:bg-[#cfe8e1] hover:border-[#002941] transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002941]"
        >
          <X className="w-5 h-5 text-[#002941]" />
        </button>

        {/* Scrollable Document Container */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-10 py-8 overscroll-contain"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#b8d8cf transparent',
          }}
        >
          <div className="mb-4 pr-12">
            <Breadcrumb items={breadcrumbItems} />
          </div>

          <header className="mb-8 border-b border-[#b8d8cf] pb-6 text-center">
            {/* Category label (plain editorial text, no badge) */}
            <span className="mb-3 inline-block text-[11px] font-bold tracking-[0.18em] text-[#335467] uppercase">
              {category}
            </span>

            <h1 className="mb-4 text-3xl leading-tight font-extrabold text-[#002941]">
              {title}
            </h1>

            <div className="flex items-center justify-center gap-5 text-xs font-semibold text-[#335467]">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#335467]" />
                {date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#335467]" />
                {readingTime} min de lectura
              </span>
            </div>
          </header>

          {/* Article Body */}
          <div className="space-y-6 text-[#335467] leading-relaxed text-base">
            {children}
          </div>

          <footer className="mt-12 pt-6 border-t border-[#b8d8cf] text-center">
            <button
              type="button"
              onClick={handleClose}
              className="btn-outline-navy min-h-[44px] text-xs font-bold inline-flex items-center gap-2 px-5 py-2.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a documentos legales</span>
            </button>
          </footer>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {mobileLayout}
      {desktopLayout}
    </>
  );
}
