'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navbar } from '@/components/navigation/navbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('nav');
  const tb = useTranslations('bingo');

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  // For VIEWER role: fetch all running games and redirect automatically
  const { data: runningGames, isLoading: gamesLoading } = useQuery<{ id: string; title: string; channelName: string }[]>({
    queryKey: ['all-running-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/all-running`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  // Auto-redirect viewer to their game
  useEffect(() => {
    if (user?.role !== 'VIEWER' || !runningGames) return;
    if (runningGames.length === 1) {
      router.replace(`/game/${runningGames[0].id}`);
    }
  }, [runningGames, user, router]);

  const isViewerLoading = isLoading || (user?.role === 'VIEWER' && gamesLoading);

  if (isViewerLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-10">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!user) return null;

  // Viewer: show game picker if multiple running games, or "no game" message
  if (user.role === 'VIEWER') {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
          {!runningGames || runningGames.length === 0 ? (
            <>
              <h1 className="text-2xl font-bold">{tb('noActiveGame')}</h1>
              <p className="text-muted-foreground">{tb('noActiveGameDesc')}</p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">{tb('selectGame')}</h1>
              <div className="flex flex-col gap-3 w-full max-w-sm">
                {runningGames.map((g) => (
                  <Link
                    key={g.id}
                    href={`/game/${g.id}`}
                    className="rounded-xl border bg-gradient-to-br from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20 p-5 flex flex-col gap-1 text-left transition-all hover:shadow-md hover:border-primary/30"
                  >
                    <span className="font-semibold">🎮 {g.title}</span>
                    <span className="text-sm text-muted-foreground">{g.channelName}</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    );
  }

  const roleLinks = [
    { role: ['MODERATOR', 'STREAMER', 'ADMIN'], href: '/moderator', label: '🛡️ Moderator-Dashboard', desc: 'Karten überwachen, Zahlen verwalten', gradient: 'from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20' },
    { role: ['STREAMER', 'ADMIN'], href: '/streamer', label: '🎬 Streamer-Verwaltung', desc: 'Spiele erstellen und konfigurieren', gradient: 'from-pink-500/10 to-rose-500/10 hover:from-pink-500/20 hover:to-rose-500/20' },
    { role: ['ADMIN'], href: '/admin', label: '⚙️ Admin-Portal', desc: 'Nutzer, Einstellungen, Bot-Status', gradient: 'from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20' },
  ].filter((l) => l.role.includes(user.role));

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-10 flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Willkommen zurück, {user.displayName}</p>
          </div>
          <Badge variant={user.role === 'ADMIN' ? 'destructive' : 'secondary'} className="ml-auto">{user.role}</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {roleLinks.map((l) => (
            <Link key={l.href} href={l.href} className={`group relative rounded-xl border bg-gradient-to-br ${l.gradient} p-5 flex flex-col gap-1.5 transition-all duration-200 hover:shadow-md hover:border-primary/30`}>
              <span className="text-base font-semibold">{l.label}</span>
              <span className="text-sm text-muted-foreground">{l.desc}</span>
            </Link>
          ))}
        </div>

        {/* Active games section — join as player */}
        {(runningGames ?? []).length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{tb('activeGames')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(runningGames ?? []).map((g) => (
                <Link
                  key={g.id}
                  href={`/game/${g.id}`}
                  className="rounded-xl border bg-gradient-to-br from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20 p-4 flex flex-col gap-1 text-left transition-all hover:shadow-md hover:border-primary/30"
                >
                  <span className="font-semibold text-sm">🎮 {g.title}</span>
                  <span className="text-xs text-muted-foreground">{g.channelName}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
