'use client';

import { useAuth } from '@/providers/auth-provider';
import { useSocket } from '@/providers/socket-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { BingoCard } from '@/components/bingo/bingo-card';
import { NumberBoard } from '@/components/bingo/number-board';
import { WinnerBoard } from '@/components/bingo/winner-board';
import { BallAnimation } from '@/components/BallAnimation';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Wifi, WifiOff, HelpCircle, X, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [socketConnected, setSocketConnected] = useState(() => socket?.connected ?? false);
  const [lastDrawnNumber, setLastDrawnNumber] = useState<number | null>(null);
  const [animNumber, setAnimNumber] = useState<number | null>(null);
  const [viewerHelpOpen, setViewerHelpOpen] = useState(false);
  const [cookieBannerVisible, setCookieBannerVisible] = useState(false);
  const [joinError, setJoinError] = useState<{
    reason?: string;
    currentValue?: number;
    requiredValue?: number;
  } | null>(null);

  useEffect(() => {
    setCookieBannerVisible(!localStorage.getItem('cookie_accepted'));
  }, []);

  // Debounced save of viewer's manual marks to server (500ms delay)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveMarksMutation = useMutation({
    mutationFn: async (marked: boolean[][]) => {
      const r = await fetch(`${API}/games/${id}/my-card/marked`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marked }),
      });
      if (!r.ok) throw new Error('Failed to save marks');
      return r.json();
    },
  });
  const handleMarkChange = useCallback((marked: boolean[][]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMarksMutation.mutate(marked);
    }, 500);
  }, [saveMarksMutation]);

  useEffect(() => {
    if (!authLoading && !user) router.replace(`/login?returnTo=/game/${id}`);
  }, [user, authLoading, router, id]);

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

  const { data: joinInfo } = useQuery<{
    channelName: string;
    status: string;
    selfEnabled: boolean;
    selfName: string;
    giftEnabled: boolean;
    giftName: string;
    configured: boolean;
  }>({
    queryKey: ['join-info', id],
    queryFn: async () => {
      const r = await fetch(`${API}/games/${id}/join-info`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user && !cardData,
  });

  const { data: allRunningGames } = useQuery<{ id: string; title: string; channelName: string }[]>({
    queryKey: ['all-running-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/all-running`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: botCmds } = useQuery<Record<string, { name: string; enabled: boolean; perm: string }>>({
    queryKey: ['bot-commands'],
    queryFn: async () => {
      const r = await fetch(`${API}/twitch/bot-commands`, { credentials: 'include' });
      if (!r.ok) return {};
      return r.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  // Buycard eligibility — only fetch if user has no card yet
  const { data: eligibility } = useQuery<{
    eligible: boolean;
    reason?: 'not_following' | 'follow_days' | 'not_subscribed' | 'sub_months' | 'scope_missing' | 'sub_months_irc_only';
    currentValue?: number;
    requiredValue?: number;
  }>({
    queryKey: ['buycard-eligibility', id],
    queryFn: async () => {
      const r = await fetch(`${API}/games/${id}/buycard-eligibility`, { credentials: 'include' });
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user && !cardData && game?.status === 'RUNNING',
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/games/${id}/join`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) {
        const e = await r.json();
        // Store structured reason for inline display
        if (e.code === 'BUYCARD_CONDITION_NOT_MET') {
          setJoinError({ reason: e.reason, currentValue: e.currentValue, requiredValue: e.requiredValue });
        }
        throw new Error(e.message || 'Error');
      }
      return r.json();
    },
    onSuccess: () => {
      setJoinError(null);
      toast.success(t('joinedGame'));
      void qc.invalidateQueries({ queryKey: ['card', id] });
    },
    onError: () => { /* reason shown inline */ },
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
      toast.success(t('gameStarted'));
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

    socket.on('number:drawn', (data: { number: number; isRandom?: boolean }) => {
      setLastDrawnNumber(data.number);
      if (data.isRandom) {
        setAnimNumber(data.number);
      } else {
        toast.info(t('numberDrawnToast', { number: data.number }), { duration: 4000 });
      }
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
      toast.success(`🏆 ${name} hat BINGO!`, { duration: 6000 });
      void qc.invalidateQueries({ queryKey: ['winners', id] });
    });
    socket.on('game:status', (data: { status: string }) => {
      if (data.status === 'STOPPED') {
        toast.info(t('gameStoppedAlert'));
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
          {t('gameNotFound')}
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
          <div className="flex items-center gap-2 flex-wrap">
            {user?.role !== 'VIEWER' && (
              <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0">
                ← Dashboard
              </a>
            )}
            {(allRunningGames ?? []).length > 1 && (
              <Select value={id} onValueChange={(v) => router.push(`/game/${v}`)}>
                <SelectTrigger className="h-8 text-sm w-auto min-w-[8rem] max-w-[14rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(allRunningGames ?? []).map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.channelName}{g.title && g.title !== g.channelName ? ` – ${g.title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(allRunningGames ?? []).length <= 1 && <h1 className="text-xl font-bold">{game.title || 'Bingo'}</h1>}
            <Badge variant={game.status === 'RUNNING' ? 'default' : game.status === 'CREATED' ? 'outline' : 'secondary'}>
              {game.status === 'RUNNING' ? t('gameRunning') : game.status === 'CREATED' ? t('gameCreated') : t('gameStopped')}
            </Badge>
            {lastDrawnNumber && game.status === 'RUNNING' && (
              <Badge variant="outline" className="text-lg font-bold px-3">
                {lastDrawnNumber}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Start button for Streamer/Admin when game is in CREATED state */}
            {['STREAMER', 'ADMIN'].includes(user?.role ?? '') && game.status === 'CREATED' && (
              <Button
                size="sm"
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
              >
                {startMutation.isPending ? t('starting') : t('startGame')}
              </Button>
            )}
            {/* Moderate button for MOD/STREAMER/ADMIN */}
            {['MODERATOR', 'STREAMER', 'ADMIN'].includes(user?.role ?? '') && game.status === 'RUNNING' && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/moderator/${id}`}>🛡️ <span className="hidden sm:inline">{t('moderate')}</span></a>
              </Button>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {socketConnected ? (
                <><Wifi className="w-3 h-3 text-green-500" /> <span className="hidden sm:inline">{t('live')}</span></>
              ) : (
                <><WifiOff className="w-3 h-3 text-red-500" /> <span className="hidden sm:inline">{t('disconnectedLabel')}</span></>
              )}
            </div>
          </div>
        </div>

        {/* Game stopped alert */}
        {game.status === 'STOPPED' && (
          <Alert>
            <AlertDescription>
              {t('gameStoppedAlert')}
            </AlertDescription>
          </Alert>
        )}

        {/* Card or join prompt – only for VIEWERs */}
        {cardData ? (
          <>
            <BingoCard
              grid={cardData.grid}
              marked={cardData.playerMarked
                ? (cardData.playerMarked as boolean[][]).map((row: boolean[]) => row.map((cell: boolean) => cell))
                : cardData.grid.map((row: unknown[]) => row.map(() => false))
              }
              onClaim={() => claimMutation.mutate()}
              gameRunning={game.status === 'RUNNING'}
              hasWon={hasWon}
              onMarkChange={handleMarkChange}
            />

          </>
        ) : game.status === 'RUNNING' && ['MODERATOR', 'STREAMER', 'ADMIN'].includes(user?.role ?? '') ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">{t('joinAsPlayer')}</p>
            <Button onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}>
              {joinMutation.isPending ? t('joining') : t('joinGame')}
            </Button>

          </div>
        ) : game.status === 'RUNNING' ? (
          <div className="flex flex-col gap-4 py-8 max-w-md mx-auto w-full">
            {/* Eligibility warning from pre-check */}
            {(eligibility && !eligibility.eligible) || joinError ? (
              <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/30 p-4 flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-0.5">
                  {(() => {
                    const r = joinError?.reason ?? eligibility?.reason;
                    const cur = joinError?.currentValue ?? eligibility?.currentValue;
                    const req = joinError?.requiredValue ?? eligibility?.requiredValue;
                    if (r === 'not_following') return <p>{t('eligibilityNotFollowing')}</p>;
                    if (r === 'follow_days') return <p>{t('eligibilityFollowDays', { current: cur ?? 0, required: req ?? 0 })}</p>;
                    if (r === 'not_subscribed') return <p>{t('eligibilityNotSubscribed')}</p>;
                    if (r === 'sub_months') return <p>{t('eligibilitySubMonths', { current: cur ?? 0, required: req ?? 0 })}</p>;
                    if (r === 'scope_missing') return <p>{t('eligibilityScopeMissing')}</p>;
                    return null;
                  })()}
                </div>
              </div>
            ) : null}
            {eligibility?.reason === 'sub_months_irc_only' && (
              <div className="rounded-lg border border-blue-400 bg-blue-50 dark:bg-blue-950/30 p-4 text-sm text-muted-foreground">
                {t('eligibilitySubMonthsIrcOnly', { cmd: botCmds?.buycard?.name ?? '!buycard' })}
              </div>
            )}
            <div className="rounded-lg border bg-muted/40 p-5 flex flex-col gap-3 text-sm">
              <p className="font-semibold text-base">{t('noCardTitle')}</p>
              <p className="text-muted-foreground">
                {t('noCardCpHint1')}{' '}
                <a
                  href={`https://www.twitch.tv/${joinInfo?.channelName ?? game.channelName}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-violet-600 dark:text-violet-400 underline underline-offset-2"
                >
                  {joinInfo?.channelName ?? game.channelName}
                </a>
                {' '}{t('noCardCpHint2')}{' '}
                <strong className="text-foreground font-mono">{joinInfo?.selfName ?? t('noCardDefaultRewardName')}</strong>
                {' '}{t('noCardCpHint3')}
              </p>
              {joinInfo?.giftEnabled && (
                <p className="text-muted-foreground">
                  {t('noCardGiftHint1')}{' '}
                  <strong className="text-foreground font-mono">{joinInfo.giftName}</strong>
                  {' '}{t('noCardGiftHint2')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">{t('noCard')}</p>
        )}

        <NumberBoard numbers={drawnNumbers} />
        <WinnerBoard winners={winners ?? []} />
      </main>

      {/* Random draw animation */}
      {animNumber !== null && (
        <BallAnimation number={animNumber} onDone={() => {
          setAnimNumber(null);
          toast.info(t('numberDrawnToast', { number: animNumber }), { duration: 3000 });
        }} />
      )}

      {/* Floating viewer help button — small and subtle */}
      <button
        onClick={() => setViewerHelpOpen(!viewerHelpOpen)}
        className={`fixed right-6 z-50 w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-white shadow-lg flex items-center justify-center transition-all duration-300 border border-white/10 ${
          cookieBannerVisible ? 'bottom-[4.5rem]' : 'bottom-6'
        } ${viewerHelpOpen ? 'ring-2 ring-white/40' : ''}`}
        title={viewerHelpOpen ? t('helpClose') : t('helpOpen')}
        aria-label={viewerHelpOpen ? t('helpClose') : t('helpOpen')}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* Viewer help side panel */}
      {viewerHelpOpen && (
        <div
          className="fixed right-0 z-30 flex flex-col bg-background border-l shadow-2xl"
          style={{ top: '3.5rem', bottom: 0, width: 'min(480px, 90vw)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-base">{t('helpTitle')}</h2>
            <button
              onClick={() => setViewerHelpOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t('helpClose')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 text-sm">
            <ViewerHelpSection step={1} title={t('helpStep1Title')} text={t('helpStep1Text')} />
            <ViewerHelpSection step={2} title={t('helpStep2Title')} text={t('helpStep2Text')} />
            <ViewerHelpSection step={3} title={t('helpStep3Title')} text={t('helpStep3Text', { bingoCmd: botCmds?.bingo?.name ?? 'bingo' })} />
            <ViewerHelpSection step={4} title={t('helpStep4Title')} text={t('helpStep4Text')} />
            <ViewerHelpSection step={5} title={t('helpStep5Title')} text={t('helpStep5Text')} />
          </div>
        </div>
      )}
    </div>
  );
}

function ViewerHelpSection({ step, title, text }: { step: number; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold">
        {step}
      </div>
      <div>
        <p className="font-semibold mb-0.5">{title}</p>
        <p className="text-muted-foreground leading-relaxed whitespace-pre-line">{text}</p>
      </div>
    </div>
  );
}
