import type { Metadata } from 'next';
import PolicyRenderer from '@/components/legal/PolicyRenderer';
import { LEGAL_POLICIES } from '@/lib/legal/policies';

const policy = LEGAL_POLICIES['privacidad'];

export const metadata: Metadata = {
  title: policy.metaTitle,
  description: policy.metaDescription,
  keywords: policy.keywords,
  alternates: {
    canonical: 'https://www.socialtools.click/legal/privacidad',
  },
};

export default function PrivacidadPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: policy.title,
    description: policy.metaDescription,
    url: 'https://www.socialtools.click/legal/privacidad',
    datePublished: '2026-11-11',
    dateModified: '2026-11-11',
    author: {
      '@type': 'Person',
      name: 'Carlos José Molina Villacorta',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SocialTools',
      url: 'https://www.socialtools.click',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PolicyRenderer policy={policy} />
    </>
  );
}
