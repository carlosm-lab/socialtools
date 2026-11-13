import type { ReactNode } from 'react';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#cfe8e1] text-[#002941]">
      {children}
    </div>
  );
}
