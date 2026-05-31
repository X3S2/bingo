'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/providers/auth-provider';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function GameRedirectPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations('bingo');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: game, isLoading: gameLoading } = useQuery({
    queryKey: ['running-game'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/running`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (game?.id) router.replace(`/game/${game.id}`);
  }, [game, router]);

  const isLoading = authLoading || gameLoading;

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
            <h1 className="text-2xl font-bold">{t('noActiveGame')}</h1>
            <p className="text-muted-foreground">
              {t('noActiveGameDesc')}
            </p>
            {user?.role !== 'VIEWER' && (
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                ← Dashboard
              </Button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
