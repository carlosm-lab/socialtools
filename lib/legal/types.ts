export type InfoBoxType = 'green' | 'blue' | 'amber' | 'alert';

export interface LegalSubSection {
  title: string;
  content: string[];
}

export interface LegalInfoBox {
  type: InfoBoxType;
  title?: string;
  text: string;
}

export interface LegalSection {
  n: number;
  title: string;
  paragraphs: string[];
  subSections?: LegalSubSection[];
  list?: string[];
  infoBox?: LegalInfoBox;
  footnote?: string;
}

export interface LegalPolicy {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  category: string;
  tagline: string;
  icon: 'shield' | 'file-text' | 'rotate-ccw' | 'scale' | 'cookie';
  date: string;
  lastUpdated: string;
  readingTime: number; // in minutes
  available: boolean;
  sections: LegalSection[];
}

export interface LegalHubDocItem {
  slug: string;
  title: string;
  tagline: string;
  icon: 'shield' | 'file-text' | 'rotate-ccw' | 'scale' | 'cookie';
  available: boolean;
  readingTime: number;
  highlight?: string;
}
