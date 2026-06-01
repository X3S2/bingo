'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

const API = process.env.NEXT_PUBLIC_API_URL!;

interface RunningGame {
  id: string;
  title: string;
  channelName: string;
  status: string;
}

/**
 * /moderator — Finds running games for the moderator/streamer.
 * Auto-redirects if exactly one game is running, otherwise shows a picker.
 */
export default function ModeratorIndexPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('moderator');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
    if (!authLoading && user && !['MODERATOR', 'STREAMER', 'ADMIN'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  // All mod-capable roles see ALL running games
  const { data: allGames, isLoading: gamesLoading } = useQuery<RunningGame[]>({
    queryKey: ['all-running-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/all-running`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  // Auto-redirect when exactly one game
  useEffect(() => {
    if (authLoading || gamesLoading) return;
    if ((allGames ?? []).length === 1) {
      router.replace(`/moderator/${allGames![0].id}`);
    }
  }, [allGames, authLoading, gamesLoading, router]);

  const isLoading = authLoading || gamesLoading;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </>
        ) : (allGames?.length ?? 0) > 1 ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors self-start">
              ← Dashboard
            </a>
            <h1 className="text-2xl font-bold">{t('selectGame')}</h1>
            <div className="flex flex-col gap-3 w-full">
              {(allGames ?? []).map((g) => (
                <Link
                  key={g.id}
                  href={`/moderator/${g.id}`}
                  className="rounded-xl border bg-gradient-to-br from-blue-500/10 to-cyan-500/10 hover:from-blue-500/20 hover:to-cyan-500/20 p-5 flex flex-col gap-1.5 text-left transition-all hover:shadow-md hover:border-primary/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">🛡️ {g.channelName}</span>
                    <Badge variant="default" className="text-xs">{t('running')}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{g.title}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              ← Dashboard
            </a>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">{t('noGame')}</p>
          </>
        )}
      </main>
    </div>
  );
}
