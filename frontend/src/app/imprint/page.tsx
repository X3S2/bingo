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

export default function ImprintPage() {
  // EN by default on /imprint
  const [showDe, setShowDe] = useState(false);

  const { data: enContent = '' } = useQuery({
    queryKey: ['impressum', 'en'],
    queryFn: () => getLegalContent('impressum_en'),
  });
  const { data: deContent = '' } = useQuery({
    queryKey: ['impressum', 'de'],
    queryFn: () => getLegalContent('impressum'),
  });

  const content = showDe ? deContent : enContent;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="flex items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{showDe ? 'Impressum' : 'Imprint'}</h1>
            <span className="text-sm font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {showDe ? 'DE' : 'EN'}
            </span>
          </div>
          <button
            onClick={() => setShowDe((v) => !v)}
            title={showDe ? 'Show in English' : 'Auf Deutsch anzeigen'}
            className="text-2xl leading-none hover:opacity-80 transition-opacity focus:outline-none"
            aria-label={showDe ? 'Show in English' : 'Auf Deutsch anzeigen'}
          >
            {showDe ? '🇬🇧' : '🇩🇪'}
          </button>
        </div>
        {content ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground">No content available.</p>
        )}
      </main>
    </div>
  );
}
