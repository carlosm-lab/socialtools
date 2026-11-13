'use client';

import { useState } from 'react';
import LegalHubBackground from '@/components/legal/LegalHubBackground';

/**
 * Client wrapper for LegalHubBackground.
 * Reads 'socialtools_legal_return' from sessionStorage using a lazy useState
 * initializer. When the user returns from reading a policy article, animations
 * are bypassed so the hub renders immediately with zero layout shift or reload illusion.
 */
export default function LegalHubClient() {
  const [animated] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      if (sessionStorage.getItem('socialtools_legal_return')) {
        sessionStorage.removeItem('socialtools_legal_return');
        return false;
      }
    } catch {
      // sessionStorage unavailable in private browsing
    }
    return true;
  });

  return <LegalHubBackground animated={animated} />;
}
