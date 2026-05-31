'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { Navbar } from '@/components/navigation/navbar';

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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{showEn ? 'Privacy Policy' : 'Datenschutzerklärung'}</h1>
            <span className="text-sm font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {showEn ? 'EN' : 'DE'}
            </span>
          </div>
          <button
            onClick={() => setShowEn((v) => !v)}
            title={showEn ? 'Auf Deutsch anzeigen' : 'Show in English'}
            className="text-2xl leading-none hover:opacity-80 transition-opacity focus:outline-none"
            aria-label={showEn ? 'Auf Deutsch anzeigen' : 'Show in English'}
          >
            {showEn ? '🇩🇪' : '🇬🇧'}
          </button>
        </div>
        {content ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground">Kein Inhalt vorhanden.</p>
        )}
      </main>
    </div>
  );
}
