'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import { Navbar } from '@/components/navigation/navbar';
import { Button } from '@/components/ui/button';

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
  const t = useTranslations('legal');
  const [showEn, setShowEn] = useState(false);

  const { data: deContent = '' } = useQuery({
    queryKey: ['datenschutz', 'de'],
    queryFn: () => getLegalContent('datenschutz'),
  });
  const { data: enContent = '' } = useQuery({
    queryKey: ['datenschutz', 'en'],
    queryFn: () => getLegalContent('datenschutz_en'),
  });

  const content = showEn ? enContent : deContent;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center justify-between mb-8 gap-4">
          <h1 className="text-3xl font-bold">{t('privacy')}</h1>
          <Button variant="outline" size="sm" onClick={() => setShowEn((v) => !v)}>
            {showEn ? t('showGerman') : t('showEnglish')}
          </Button>
        </div>
        {content ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground">{t('privacyEmpty')}</p>
        )}
      </main>
    </div>
  );
}
