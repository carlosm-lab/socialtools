import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.socialtools.click';
  const lastModified = new Date('2026-11-11T00:00:00.000Z');

  return [
    { url: `${baseUrl}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/checkout`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/legal`, lastModified, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/legal/privacidad`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/legal/terminos`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/legal/reembolsos`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/legal/aviso-legal`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/legal/cookies`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
  ];
}

