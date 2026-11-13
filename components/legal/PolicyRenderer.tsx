import type { ReactNode } from 'react';
import LegalArticleReader from '@/components/legal/LegalArticleReader';
import LegalHubBackground from '@/components/legal/LegalHubBackground';
import {
  Section,
  Hr,
  InfoBox,
  P,
  Ul,
  H3,
  A,
  LegalFootnote,
} from '@/components/legal/LegalContent';
import type { LegalPolicy } from '@/lib/legal/types';

function renderTextWithLinks(text: string): ReactNode {
  const regex = /(https?:\/\/[^\s)]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const parts = text.split(regex);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <A key={i} href={part} external>
          {part}
        </A>
      );
    }
    if (part.includes('@') && !part.includes(' ')) {
      return (
        <A key={i} href={`mailto:${part}`}>
          {part}
        </A>
      );
    }
    return part;
  });
}

export interface PolicyRendererProps {
  policy: LegalPolicy;
  topBanner?: ReactNode;
}

export default function PolicyRenderer({ policy, topBanner }: PolicyRendererProps) {
  return (
    <main className="min-h-screen bg-[#cfe8e1]">
      {/* Desktop Background Hub behind modal overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none hidden select-none lg:block"
      >
        <LegalHubBackground animated={false} />
      </div>

      <LegalArticleReader
        title={policy.title}
        category={policy.category}
        date={policy.date}
        readingTime={policy.readingTime}
      >
        {topBanner}

        {policy.sections.map((sec, idx) => (
          <div key={sec.n}>
            <Section n={sec.n} title={sec.title}>
              {sec.infoBox && (
                <InfoBox type={sec.infoBox.type} title={sec.infoBox.title}>
                  {renderTextWithLinks(sec.infoBox.text)}
                </InfoBox>
              )}

              {sec.paragraphs.map((para, pIdx) => (
                <P key={pIdx}>{renderTextWithLinks(para)}</P>
              ))}

              {sec.subSections &&
                sec.subSections.map((sub, sIdx) => (
                  <div key={sIdx} className="mt-3 space-y-2">
                    <H3>{sub.title}</H3>
                    {sub.content.map((c, cIdx) => (
                      <P key={cIdx}>{renderTextWithLinks(c)}</P>
                    ))}
                  </div>
                ))}

              {sec.list && (
                <Ul items={sec.list.map((item) => renderTextWithLinks(item))} />
              )}

              {sec.footnote && (
                <LegalFootnote>
                  {renderTextWithLinks(sec.footnote)}
                </LegalFootnote>
              )}
            </Section>
            {idx < policy.sections.length - 1 && <Hr />}
          </div>
        ))}
      </LegalArticleReader>
    </main>
  );
}
