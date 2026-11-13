import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Ruta de navegación"
      className={`flex max-w-full min-w-0 text-xs sm:text-sm text-[#335467] ${className}`}
    >
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-normal">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={`${item.label}-${index}`}
              className="inline-flex min-w-0 items-center"
            >
              {index > 0 && (
                <ChevronRight
                  className="w-3.5 h-3.5 mx-0.5 text-[#335467]/50 shrink-0"
                  aria-hidden="true"
                />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="min-h-[32px] inline-flex items-center text-xs sm:text-sm text-[#335467] hover:text-[#002941] hover:underline transition-colors break-words"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`text-xs sm:text-sm break-words ${
                    isLast ? 'font-bold text-[#002941]' : 'text-[#335467]'
                  }`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumb;
