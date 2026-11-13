import type { Metadata } from 'next';
import LegalHubClient from '@/components/legal/LegalHubClient';

export const metadata: Metadata = {
  title: 'Políticas y Documentación Legal | SocialTools',
  description:
    'Centro oficial de documentación legal de SocialTools: política de privacidad, términos de servicio, política estricta de no reembolso, aviso legal y cookies.',
  alternates: {
    canonical: 'https://www.socialtools.click/legal',
  },
};

export default function LegalHubPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Políticas y Documentación Legal | SocialTools',
    url: 'https://www.socialtools.click/legal',
    description:
      'Centro oficial de documentación legal de SocialTools: política de privacidad, términos de servicio, política estricta de no reembolso, aviso legal y cookies.',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Inicio',
          item: 'https://www.socialtools.click',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Legal',
          item: 'https://www.socialtools.click/legal',
        },
      ],
    },
  };

  return (
    <main className="min-h-screen bg-[#cfe8e1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LegalHubClient />
    </main>
  );
}
