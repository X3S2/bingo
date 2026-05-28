'use client';

import { useAuth } from '@/providers/auth-provider';
import { useSocket } from '@/providers/socket-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { BingoCard } from '@/components/bingo/bingo-card';
import { NumberBoard } from '@/components/bingo/number-board';
import { WinnerBoard } from '@/components/bingo/winner-board';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const API = process.env.NEXT_PUBLIC_API_URL!;

interface GamePage {
  params: Promise<{ id: string }>;
}

export default function GamePage({ params }: GamePage) {
  const { id } = use(params);
  const { user, isLoading: authLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('bingo');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: game, isLoading: gameLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const r = await fetch(`${API}/bingo/${id}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Game not found');
      return r.json();
    },
    enabled: !!user,
  });

  const { data: cardData, isLoading: cardLoading } = useQuery({
    queryKey: ['card', id],
    queryFn: async () => {
      const r = await fetch(`${API}/bingo/${id}/my-card`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user,
  });

  const { data: winners } = useQuery({
    queryKey: ['winners', id],
    queryFn: async () => {
      const r = await fetch(`${API}/bingo/${id}/winners`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/bingo/${id}/claim-bingo`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Error');
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(t('youWon'));
      void qc.invalidateQueries({ queryKey: ['winners', id] });
      void qc.invalidateQueries({ queryKey: ['card', id] });
    },
    onError: () => toast.error(t('alreadyClaimed')),
  });

  // Real-time events
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join:game', { gameId: id });
    socket.on('number:drawn', () => {
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['card', id] });
    });
    socket.on('number:removed', () => {
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['card', id] });
    });
    socket.on('card:updated', () => void qc.invalidateQueries({ queryKey: ['card', id] }));
    socket.on('winner:added', () => void qc.invalidateQueries({ queryKey: ['winners', id] }));
    socket.on('game:status', () => void qc.invalidateQueries({ queryKey: ['game', id] }));
    return () => {
      socket.emit('leave:game', { gameId: id });
      socket.off('number:drawn');
      socket.off('number:removed');
      socket.off('card:updated');
      socket.off('winner:added');
      socket.off('game:status');
    };
  }, [socket, id, qc]);

  const isLoading = authLoading || gameLoading || cardLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-72 w-full max-w-sm mx-auto" />
        </main>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-16 text-center text-muted-foreground">
          Spiel nicht gefunden.
        </main>
      </div>
    );
  }

  const hasWon = (winners ?? []).some((w: { user: { id: string } }) => w.user?.id === user?.id);
  const drawnNumbers = (game.drawnNumbers ?? []).map((d: { number: number }) => d.number);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-6 max-w-2xl">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">{game.title || 'Bingo'}</h1>
          <Badge variant={game.status === 'RUNNING' ? 'default' : 'secondary'}>
            {game.status === 'RUNNING' ? t('gameRunning') : t('gameStopped')}
          </Badge>
        </div>

        {cardData ? (
          <BingoCard
            grid={cardData.grid}
            marked={cardData.marked}
            onClaim={() => claimMutation.mutate()}
            gameRunning={game.status === 'RUNNING'}
            hasWon={hasWon}
          />
        ) : (
          <p className="text-muted-foreground text-center py-8">{t('noCard')}</p>
        )}

        <NumberBoard numbers={drawnNumbers} />
        <WinnerBoard winners={winners ?? []} />
      </main>
    </div>
  );
}
