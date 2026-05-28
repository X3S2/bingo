import { getTranslations } from 'next-intl/server';
import ReactMarkdown from 'react-markdown';
import { Navbar } from '@/components/navigation/navbar';

async function getLegalContent(key: string): Promise<string> {
  try {
    const r = await fetch(
      `${process.env.INTERNAL_API_URL || 'http://streambingo-api:3001'}/api/admin/settings/${key}`,
      { next: { revalidate: 300 } },
    );
    if (!r.ok) return '';
    const d = await r.json();
    return d?.value ?? '';
  } catch {
    return '';
  }
}

export default async function DatenschutzPage() {
  const t = await getTranslations('legal');
  const content = await getLegalContent('datenschutz');

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-3xl font-bold mb-8">{t('privacy')}</h1>
        {content ? (
          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-muted-foreground">Keine Datenschutzerklärung hinterlegt.</p>
        )}
      </main>
    </div>
  );
}
