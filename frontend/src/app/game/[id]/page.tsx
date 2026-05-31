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
import { BingoCard } from '@/components/bingo/bingo-card';
import { NumberBoard } from '@/components/bingo/number-board';
import { WinnerBoard } from '@/components/bingo/winner-board';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff } from 'lucide-react';

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
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastDrawnNumber, setLastDrawnNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: game, isLoading: gameLoading } = useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const r = await fetch(`${API}/games/${id}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Game not found');
      return r.json();
    },
    enabled: !!user,
  });

  const { data: cardData, isLoading: cardLoading } = useQuery({
    queryKey: ['card', id],
    queryFn: async () => {
      const r = await fetch(`${API}/games/${id}/my-card`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user,
  });

  const { data: winners } = useQuery({
    queryKey: ['winners', id],
    queryFn: async () => {
      const r = await fetch(`${API}/games/${id}/winners`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/games/${id}/cards`, {
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
      toast.success(t('joinedGame'));
      void qc.invalidateQueries({ queryKey: ['card', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/games/${id}/claim-bingo`, {
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
      toast.success(t('youWon'), { duration: 6000 });
      void qc.invalidateQueries({ queryKey: ['winners', id] });
      void qc.invalidateQueries({ queryKey: ['card', id] });
    },
    onError: (e: Error) => toast.error(e.message || t('alreadyClaimed')),
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/games/${id}/start`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Fehler beim Starten');
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success('Spiel gestartet!');
      void qc.invalidateQueries({ queryKey: ['game', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Real-time events
  useEffect(() => {
    if (!socket || !id) return;

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.emit('join:game', { gameId: id });
    setSocketConnected(socket.connected);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    socket.on('number:drawn', (data: { number: number }) => {
      setLastDrawnNumber(data.number);
      toast.info(`🎱 Nummer ${data.number} gezogen!`, { duration: 4000 });
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['card', id] });
    });
    socket.on('number:removed', () => {
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['card', id] });
    });
    socket.on('card:updated', () => void qc.invalidateQueries({ queryKey: ['card', id] }));
    socket.on('winner:added', (data: { user?: { displayName?: string } }) => {
      const name = data?.user?.displayName ?? 'Jemand';
      toast.success(`ðŸ† ${name} hat BINGO!`, { duration: 6000 });
      void qc.invalidateQueries({ queryKey: ['winners', id] });
    });
    socket.on('game:status', (data: { status: string }) => {
      if (data.status === 'STOPPED') {
        toast.info('Das Spiel wurde beendet.');
      }
      void qc.invalidateQueries({ queryKey: ['game', id] });
    });

    return () => {
      socket.emit('leave:game', { gameId: id });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
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
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-72 w-full max-w-sm mx-auto mb-4" />
          <Skeleton className="h-32 w-full" />
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
        {/* Game Header */}
        <div className="flex items-center gap-3 flex-wrap justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Dashboard
            </a>
            <h1 className="text-xl font-bold">{game.title || 'Bingo'}</h1>
            <Badge variant={game.status === 'RUNNING' ? 'default' : game.status === 'CREATED' ? 'outline' : 'secondary'}>
              {game.status === 'RUNNING' ? t('gameRunning') : game.status === 'CREATED' ? 'Bereit' : t('gameStopped')}
            </Badge>
            {lastDrawnNumber && game.status === 'RUNNING' && (
              <Badge variant="outline" className="text-lg font-bold px-3">
                {lastDrawnNumber}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Start button for Streamer/Admin when game is in CREATED state */}
            {['STREAMER', 'ADMIN'].includes(user?.role ?? '') && game.status === 'CREATED' && (
              <Button
                size="sm"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? 'Startet...' : '▶ Spiel starten'}
              </Button>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {socketConnected ? (
                <><Wifi className="w-3 h-3 text-green-500" /> Live</>
              ) : (
                <><WifiOff className="w-3 h-3 text-red-500" /> Getrennt</>
              )}
            </div>
          </div>
        </div>

        {/* Game stopped alert */}
        {game.status === 'STOPPED' && (
          <Alert>
            <AlertDescription>
              Dieses Spiel wurde beendet. Du kannst das Ergebnis noch einsehen.
            </AlertDescription>
          </Alert>
        )}

        {/* Card or join prompt – only for VIEWERs */}
        {cardData ? (
          <BingoCard
            grid={cardData.grid}
            marked={cardData.marked}
            onClaim={() => claimMutation.mutate()}
            gameRunning={game.status === 'RUNNING'}
            hasWon={hasWon}
          />
        ) : ['MODERATOR', 'STREAMER', 'ADMIN'].includes(user?.role ?? '') ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Als {user?.role} benötigst du keine eigene Karte.
              Nutze das <a href={`/moderator/${id}`} className="underline underline-offset-2">Moderator-Dashboard</a> für die Spielverwaltung.
            </p>
          </div>
        ) : game.status === 'RUNNING' ? (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground">{t('noCard')}</p>
            <Button
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
            >
              {joinMutation.isPending ? 'Bitte warten…' : t('joinGame')}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">{t('noCard')}</p>
        )}

        <NumberBoard numbers={drawnNumbers} />
        <WinnerBoard winners={winners ?? []} />
      </main>
    </div>
  );
}
