'use client';

import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Navbar } from '@/components/navigation/navbar';
import { useLocaleToggle } from '@/providers/locale-provider';
import { useTranslations } from 'next-intl';

const API = process.env.NEXT_PUBLIC_API_URL!;

async function getLegalContent(key: string): Promise<string> {
  try {
    const r = await fetch(`${API}/admin/settings/${key}`, { credentials: 'include' });
    if (!r.ok) return '';
    const d = await r.json();
    return d?.value ?? '';
  } catch {
    return '';
  }
}

export default function DatenschutzPage() {
  const { locale } = useLocaleToggle();
  const tc = useTranslations('common');

  const { data: deContent = '' } = useQuery({
    queryKey: ['datenschutz', 'de'],
    queryFn: () => getLegalContent('datenschutz'),
  });
  const { data: enContent = '' } = useQuery({
    queryKey: ['datenschutz', 'en'],
    queryFn: () => getLegalContent('datenschutz_en'),
  });

  const content = locale === 'en' ? enContent : deContent;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">
          {locale === 'en' ? 'Privacy Policy' : 'Datenschutzerklärung'}
        </h1>
        {content ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground">{tc('noContent')}</p>
        )}
        <div className="mt-8 pt-6 border-t">
          <p className="text-sm text-muted-foreground">
            {locale === 'en' ? 'See also:' : 'Siehe auch:'}{' '}
            <a href="/impressum" className="text-primary hover:underline">
              {locale === 'en' ? 'Imprint' : 'Impressum'}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
