'use client';

import { useAuth } from '@/providers/auth-provider';
import { useSocket } from '@/providers/socket-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { NumberBoard } from '@/components/bingo/number-board';
import { WinnerBoard } from '@/components/bingo/winner-board';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

const API = process.env.NEXT_PUBLIC_API_URL!;

interface ModPage {
  params: Promise<{ id: string }>;
}

export default function ModeratorPage({ params }: ModPage) {
  const { id } = use(params);
  const { user, isLoading: authLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('moderator');
  const tb = useTranslations('bingo');
  const [numberInput, setNumberInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!authLoading && user && !['MODERATOR', 'STREAMER', 'ADMIN'].includes(user.role)) {
      router.replace('/dashboard');
    }
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: game } = useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const r = await fetch(`${API}/bingo/${id}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Game not found');
      return r.json();
    },
    enabled: !!user,
  });

  const { data: cards } = useQuery({
    queryKey: ['cards', id],
    queryFn: async () => {
      const r = await fetch(`${API}/bingo/${id}/cards`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
    refetchInterval: 10_000,
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

  const drawMutation = useMutation({
    mutationFn: async (number: number) => {
      const r = await fetch(`${API}/bingo/${id}/numbers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      });
      if (!r.ok) throw new Error('Failed to draw number');
      return r.json();
    },
    onSuccess: () => {
      toast.success(`Zahl ${numberInput} gezogen`);
      setNumberInput('');
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['cards', id] });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (number: number) => {
      const r = await fetch(`${API}/bingo/${id}/numbers/${number}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Failed to remove number');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['cards', id] });
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!socket || !id) return;
    socket.emit('join:game', { gameId: id });
    socket.emit('join:mod', { gameId: id });
    socket.on('number:drawn', () => {
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['cards', id] });
    });
    socket.on('number:removed', () => {
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['cards', id] });
    });
    socket.on('winner:added', () => void qc.invalidateQueries({ queryKey: ['winners', id] }));
    return () => {
      socket.off('number:drawn');
      socket.off('number:removed');
      socket.off('winner:added');
    };
  }, [socket, id, qc]);

  const drawnNumbers = (game?.drawnNumbers ?? []).map((d: { number: number }) => d.number);
  const filteredCards = (cards ?? []).filter((c: { user: { displayName: string } }) =>
    c.user?.displayName?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold">{t('title')}</h1>
          {game && (
            <Badge variant={game.status === 'RUNNING' ? 'default' : 'secondary'}>
              {game.status === 'RUNNING' ? tb('gameRunning') : tb('gameStopped')}
            </Badge>
          )}
        </div>

        {/* Draw / remove number */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('drawNumber')}</CardTitle></CardHeader>
          <CardContent className="flex gap-2">
            <Input
              type="number"
              min={1}
              max={75}
              placeholder={t('numberInput')}
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              className="max-w-[140px]"
            />
            <Button
              onClick={() => drawMutation.mutate(parseInt(numberInput, 10))}
              disabled={!numberInput || drawMutation.isPending}
            >
              {t('drawNumber')}
            </Button>
            <Button
              variant="outline"
              onClick={() => removeMutation.mutate(parseInt(numberInput, 10))}
              disabled={!numberInput || removeMutation.isPending}
            >
              {t('removeNumber')}
            </Button>
          </CardContent>
        </Card>

        <NumberBoard numbers={drawnNumbers} />
        <WinnerBoard winners={winners ?? []} />

        {/* All cards */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">{t('allCards')} ({filteredCards.length})</h2>
            <Input
              placeholder={t('search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-[200px]"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredCards.map((c: {
              id: string;
              user: { displayName: string; profileImageUrl?: string };
              proximityScore?: number;
            }) => (
              <Card key={c.id} className="overflow-hidden">
                <CardHeader className="py-2 px-3 flex-row items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={c.user.profileImageUrl} alt={c.user.displayName} />
                    <AvatarFallback>{c.user.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium truncate">{c.user.displayName}</span>
                  {c.proximityScore !== undefined && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {t('proximity')}: {c.proximityScore}
                    </Badge>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
