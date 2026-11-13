import type { Metadata } from 'next';
import PolicyRenderer from '@/components/legal/PolicyRenderer';
import { InfoBox } from '@/components/legal/LegalContent';
import { LEGAL_POLICIES } from '@/lib/legal/policies';

const policy = LEGAL_POLICIES['reembolsos'];

export const metadata: Metadata = {
  title: policy.metaTitle,
  description: policy.metaDescription,
  keywords: policy.keywords,
  alternates: {
    canonical: 'https://www.socialtools.click/legal/reembolsos',
  },
};

export default function ReembolsosPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: policy.title,
    description: policy.metaDescription,
    url: 'https://www.socialtools.click/legal/reembolsos',
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

  const topBanner = (
    <InfoBox type="alert" title="AVISO IMPORTANTE SOBRE PAGOS IRREVOCABLES">
      Todo pago realizado a SocialTools por concepto de paquetes de créditos de video
      (mínimo 5 videos a $1.00 USD c/u) o suscripciones periódicas (Plan Creador Anual
      a $79.00 USD/año y planes de Agencia) es DEFINITIVO, FIRME, IRREVOCABLE Y NO
      REEMBOLSABLE bajo ninguna circunstancia.
    </InfoBox>
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PolicyRenderer policy={policy} topBanner={topBanner} />
    </>
  );
}
