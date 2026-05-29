import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageToolbar } from '@/components/page-toolbar';

export default async function HelpPage() {
  const t = await getTranslations('help');

  const guides = [
    {
      icon: '🎮',
      key: t('viewers'),
      content: [t('viewersItem1'), t('viewersItem2'), t('viewersItem3'), t('viewersItem4')],
    },
    {
      icon: '🛡️',
      key: t('moderators'),
      content: [t('moderatorsItem1'), t('moderatorsItem2'), t('moderatorsItem3'), t('moderatorsItem4')],
    },
    {
      icon: '🎬',
      key: t('redeems'),
      content: [t('redeemsItem1'), t('redeemsItem2'), t('redeemsItem3'), t('redeemsItem4')],
    },
  ];

  return (
    <main className="container mx-auto px-4 py-12 max-w-3xl flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {`← ${t('back')}`}
          </Link>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
        </div>
        <PageToolbar />
      </div>
      {guides.map((g) => (
        <Card key={g.key}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{g.icon}</span> {g.key}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {g.content.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      ))}
    </main>
  );
}