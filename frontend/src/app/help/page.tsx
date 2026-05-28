import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function HelpPage() {
  const t = await getTranslations('help');

  const guides = [
    {
      icon: '🎮',
      key: t('viewers'),
      content: [
        'Melde dich mit deinem Twitch-Account an.',
        'Löse Channel Points ein (SELF), um eine Bingo-Karte zu erhalten.',
        'Zahlen werden automatisch auf deiner Karte markiert.',
        'Sobald eine Reihe, Spalte oder Diagonale voll ist, klicke auf "BINGO melden".',
      ],
    },
    {
      icon: '🛡️',
      key: t('moderators'),
      content: [
        '!zahl+N – Zahl N ziehen (N = 1–75)',
        '!zahl-N – Zahl N entfernen',
        'bingo – Bingo im Chat bestätigen (als Viewer)',
        'Nutze das Moderator-Dashboard für eine vollständige Übersicht aller Karten.',
      ],
    },
    {
      icon: '🎬',
      key: t('redeems'),
      content: [
        'Erstelle Channel Point Redeems in deinen Twitch-Creator-Einstellungen.',
        'Trage den Redeem-Titel in der Streamer-Verwaltung ein.',
        'SELF-Redeem: Viewer erhält eigene Karte.',
        'GIFT-Redeem: Viewer gibt Benutzernamen ein, jener erhält eine Karte.',
      ],
    },
  ];

  return (
    <main className="container mx-auto px-4 py-12 max-w-3xl flex flex-col gap-8">
      <h1 className="text-3xl font-bold">{t('title')}</h1>
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
