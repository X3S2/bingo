import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { PageToolbar } from '@/components/page-toolbar';

export default async function HomePage() {
  const t = await getTranslations();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-16 gap-8 text-center">
      <div className="fixed top-4 right-4 z-50">
        <PageToolbar />
      </div>

      <div className="flex flex-col items-center gap-4 max-w-2xl">
        <div className="rounded-2xl bg-primary/10 p-4 mb-2">
          <span className="text-5xl font-black tracking-tight text-primary">StreamBingo</span>
        </div>
        <p className="text-xl text-muted-foreground max-w-lg">
          {t('home.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <Button
            asChild
            size="lg"
            className="min-w-[180px] bg-[#9146FF] hover:bg-[#772CE8] text-white"
          >
            <a href="/api/auth/twitch">{t('nav.login')}</a>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/help">{t('nav.help')}</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl w-full mt-8">
        {[
          { icon: '🎮', title: t('home.roleStreamer'), desc: t('home.roleStreamerDesc') },
          { icon: '👁️', title: t('home.roleViewer'), desc: t('home.roleViewerDesc') },
          { icon: '🛡️', title: t('home.roleModerator'), desc: t('home.roleModeratorDesc') },
        ].map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-5 text-left hover:border-primary/50 transition-colors">
            <div className="text-3xl mb-2">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
