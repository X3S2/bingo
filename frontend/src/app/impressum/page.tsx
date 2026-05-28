import { getTranslations } from 'next-intl/server';

async function getLegalContent(key: string): Promise<string> {
  try {
    const r = await fetch(`${process.env.INTERNAL_API_URL || 'http://streambingo-api:3001'}/api/admin/settings/${key}`, {
      next: { revalidate: 300 },
    });
    if (!r.ok) return '';
    const d = await r.json();
    return d?.value ?? '';
  } catch {
    return '';
  }
}

export default async function ImpressumPage() {
  const t = await getTranslations('legal');
  const content = await getLegalContent('impressum');

  return (
    <main className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-8">{t('impressum')}</h1>
      {content ? (
        <div
          className="prose dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <p className="text-muted-foreground">Kein Impressum hinterlegt.</p>
      )}
    </main>
  );
}
