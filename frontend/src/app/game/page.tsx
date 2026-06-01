'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL!;
const MOD_ROLES = ['MODERATOR', 'STREAMER', 'ADMIN'];

export default function GamePickerPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('bingo');
  const tm = useTranslations('moderator');
  const ts = useTranslations('streamer');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: runningGames, isLoading: gamesLoading } = useQuery<{ id: string; title: string; channelName: string }[]>({
    queryKey: ['all-running-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/all-running`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  // VIEWER: auto-redirect if exactly one game running
  useEffect(() => {
    if (user?.role !== 'VIEWER' || !runningGames) return;
    if (runningGames.length === 1) router.replace(`/game/${runningGames[0].id}`);
  }, [runningGames, user, router]);

  const isLoading = authLoading || gamesLoading;
  const isModRole = user && MOD_ROLES.includes(user.role);
  const games = runningGames ?? [];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
        {isLoading ? (
          <div className="flex flex-col gap-3 w-full max-w-sm">
            {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : games.length === 0 ? (
          <>
            <h1 className="text-2xl font-bold">{t('noActiveGame')}</h1>
            <p className="text-muted-foreground">{t('noActiveGameDesc')}</p>
            {user?.role !== 'VIEWER' && (
              <Button variant="outline" onClick={() => router.push('/dashboard')}>← Dashboard</Button>
            )}
          </>
        ) : (
          <>
            {user?.role !== 'VIEWER' && (
              <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors self-start">
                ← Dashboard
              </a>
            )}
            <h1 className="text-2xl font-bold">{t('activeGames')}</h1>
            <div className="flex flex-col gap-3 w-full max-w-sm">
              {games.map((g) =>
                user?.role === 'VIEWER' ? (
                  <Link
                    key={g.id}
                    href={`/game/${g.id}`}
                    className="rounded-xl border bg-gradient-to-br from-violet-500/10 to-purple-500/10 hover:from-violet-500/20 hover:to-purple-500/20 p-5 flex flex-col gap-1 text-left transition-all hover:shadow-md hover:border-primary/30"
                  >
                    <span className="font-semibold">🎮 {g.channelName}</span>
                    <span className="text-sm text-muted-foreground">{g.title}</span>
                  </Link>
                ) : (
                  <div
                    key={g.id}
                    className="rounded-xl border bg-gradient-to-br from-violet-500/10 to-purple-500/10 p-5 flex flex-col gap-2 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">🎮 {g.channelName}</span>
                      <Badge variant="default" className="text-xs shrink-0">{tm('running')}</Badge>
                    </div>
                    {g.title && <span className="text-sm text-muted-foreground">{g.title}</span>}
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" asChild className="flex-1">
                        <Link href={`/game/${g.id}`}>{t('joinGame')}</Link>
                      </Button>
                      {isModRole && (
                        <Button size="sm" variant="outline" asChild className="flex-1">
                          <Link href={`/moderator/${g.id}`}>🛡️ {ts('moderate')}</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
