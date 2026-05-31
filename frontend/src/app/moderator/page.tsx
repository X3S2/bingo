'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { Skeleton } from '@/components/ui/skeleton';

const API = process.env.NEXT_PUBLIC_API_URL!;

/**
 * /moderator — Finds the currently running game for the configured channel
 * and redirects the moderator there. Useful as a bookmark target.
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

  const { data: games, isLoading: gamesLoading } = useQuery({
    queryKey: ['my-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/my-games`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user && ['STREAMER', 'ADMIN'].includes(user?.role ?? ''),
  });

  // Streamer: redirect to their own running game
  useEffect(() => {
    if (!games) return;
    const running = games.find((g: { status: string; id: string }) => g.status === 'RUNNING');
    if (running) {
      router.replace(`/moderator/${running.id}`);
    }
  }, [games, router]);

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
        ) : (
          <>
            <a
              href="/dashboard"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              ← Dashboard
            </a>
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground">
              {t('noGame')}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
