import type { ReactNode } from 'react';

/* ── Inline Anchor ───────────────────────────────────────────────────────── */
export interface AProps {
  href: string;
  children: ReactNode;
  external?: boolean;
}

export function A({ href, children, external = false }: AProps) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="text-[#002941] font-bold underline underline-offset-4 decoration-[#b8d8cf] hover:decoration-[#002941] transition-colors break-words"
    >
      {children}
    </a>
  );
}

/* ── Roman Numeral Helper ─────────────────────────────────────────────────── */
const ROMAN_MAP: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRoman(n: number): string {
  let result = '';
  let rem = n;
  for (const [val, sym] of ROMAN_MAP) {
    while (rem >= val) {
      result += sym;
      rem -= val;
    }
  }
  return result;
}

/* ── Section Component (Strictly rounded-md badge, ZERO pill badges) ─────── */
export interface SectionProps {
  n: number;
  title: string;
  children: ReactNode;
}

export function Section({ n, title, children }: SectionProps) {
  const roman = toRoman(n);
  return (
    <section className="mb-8">
      <h2 className="flex items-start gap-3 text-base sm:text-lg font-bold text-[#002941] mb-3 leading-snug">
        <span
          className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-[#cfe8e1] border border-[#b8d8cf] text-[#002941] font-black text-xs shrink-0 select-none mt-0.5"
          aria-label={`Sección ${n}`}
        >
          {roman}
        </span>
        <span className="flex-1">{title}</span>
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* ── Horizontal Divider ─────────────────────────────────────────────────── */
export function Hr() {
  return <hr className="border-t border-[#b8d8cf] my-6" />;
}

/* ── InfoBox Component (Single flat container, ZERO nested cards) ─────────── */
export type InfoBoxType = 'green' | 'blue' | 'amber' | 'alert';

const INFO_STYLES: Record<
  InfoBoxType,
  { bg: string; border: string; color: string; titleColor: string }
> = {
  green: {
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    color: 'text-[#166534]',
    titleColor: 'text-[#14532d]',
  },
  blue: {
    bg: 'bg-[#eff6ff]',
    border: 'border-[#bfdbfe]',
    color: 'text-[#1e40af]',
    titleColor: 'text-[#1e3a8a]',
  },
  amber: {
    bg: 'bg-[#fffbeb]',
    border: 'border-[#fde68a]',
    color: 'text-[#92400e]',
    titleColor: 'text-[#78350f]',
  },
  alert: {
    bg: 'bg-[#fdf2f2]',
    border: 'border-[#fca5a5]',
    color: 'text-[#7f1d1d]',
    titleColor: 'text-[#991b1b]',
  },
};

export interface InfoBoxProps {
  type: InfoBoxType;
  title?: string;
  children: ReactNode;
}

export function InfoBox({ type, title, children }: InfoBoxProps) {
  const s = INFO_STYLES[type] || INFO_STYLES.blue;
  return (
    <aside
      className={`rounded-xl border ${s.bg} ${s.border} p-4 sm:p-5 mb-5 space-y-1.5`}
    >
      {title && (
        <h4 className={`text-sm sm:text-base font-bold ${s.titleColor}`}>
          {title}
        </h4>
      )}
      <div className={`text-xs sm:text-sm leading-relaxed ${s.color}`}>
        {children}
      </div>
    </aside>
  );
}

/* ── Paragraph ───────────────────────────────────────────────────────────── */
export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm sm:text-base text-[#335467] leading-relaxed mb-3 text-justify sm:text-left">
      {children}
    </p>
  );
}

/* ── Heading 3 ───────────────────────────────────────────────────────────── */
export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-sm sm:text-base font-bold text-[#002941] mt-5 mb-2">
      {children}
    </h3>
  );
}

/* ── Unordered List ──────────────────────────────────────────────────────── */
export function Ul({ items }: { items: (string | ReactNode)[] }) {
  return (
    <ul className="list-disc pl-5 space-y-2 text-sm sm:text-base text-[#335467] mb-4">
      {items.map((item, i) => (
        <li key={i} className="leading-relaxed">
          {item}
        </li>
      ))}
    </ul>
  );
}

/* ── Footnote Note ───────────────────────────────────────────────────────── */
export function LegalFootnote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 p-4 sm:p-5 bg-[#f7fbf9] border border-[#b8d8cf] rounded-xl text-xs sm:text-sm text-[#335467] italic leading-relaxed">
      {children}
    </div>
  );
}
