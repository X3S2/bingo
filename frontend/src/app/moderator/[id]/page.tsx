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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, Wifi, WifiOff, ChevronDown, ChevronUp, X, HelpCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL!;

// Calculates how many cells away from bingo (lower = closer to bingo)
function proximityScore(marked: boolean[][]): number {
  let best = 999;
  // rows
  for (let r = 0; r < 5; r++) {
    const unmarked = marked[r].filter((v) => !v).length;
    if (unmarked < best) best = unmarked;
  }
  // cols
  for (let c = 0; c < 5; c++) {
    const unmarked = marked.map((row) => row[c]).filter((v) => !v).length;
    if (unmarked < best) best = unmarked;
  }
  // diagonal TL-BR
  const d1 = [0, 1, 2, 3, 4].map((i) => marked[i][i]).filter((v) => !v).length;
  if (d1 < best) best = d1;
  // diagonal TR-BL
  const d2 = [0, 1, 2, 3, 4].map((i) => marked[i][4 - i]).filter((v) => !v).length;
  if (d2 < best) best = d2;
  return best;
}

interface BingoCardMini {
  id: string;
  grid: (number | null)[][];
  marked: boolean[][];
  user: { id: string; displayName: string; profileImageUrl?: string };
}

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
  const [sortBy, setSortBy] = useState<'proximity' | 'name'>('proximity');
  const [showCmds, setShowCmds] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [cookieBannerVisible, setCookieBannerVisible] = useState(false);

  useEffect(() => {
    setCookieBannerVisible(!localStorage.getItem('cookie_accepted'));
  }, []);

  // Query all available games for the mod switcher — all roles see ALL running games
  const { data: availableGames } = useQuery<{ id: string; title: string; channelName: string }[]>({
    queryKey: ['available-mod-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/all-running`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!authLoading && user && !['MODERATOR', 'STREAMER', 'ADMIN'].includes(user.role)) {
      router.replace('/dashboard');
    }
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: game } = useQuery({
    queryKey: ['game', id],
    queryFn: async () => {
      const r = await fetch(`${API}/games/${id}`, { credentials: 'include' });
      if (!r.ok) throw new Error('Game not found');
      return r.json();
    },
    enabled: !!user,
  });

  const { data: cards } = useQuery<BingoCardMini[]>({
    queryKey: ['cards', id],
    queryFn: async () => {
      const r = await fetch(`${API}/games/${id}/cards`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
    refetchInterval: 15_000,
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

  const { data: botCmds } = useQuery<Record<string, { name: string; enabled: boolean; perm: string; label: string }>>({  
    queryKey: ['bot-commands'],
    queryFn: async () => {
      const r = await fetch(`${API}/twitch/bot-commands`, { credentials: 'include' });
      if (!r.ok) return {};
      return r.json();
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: botJoinStatus } = useQuery<{ botJoined: boolean }>({
    queryKey: ['bot-joined', game?.channelName],
    queryFn: async () => {
      const r = await fetch(`${API}/twitch/bot-joined/${encodeURIComponent(game!.channelName)}`, { credentials: 'include' });
      if (!r.ok) return { botJoined: false };
      return r.json();
    },
    enabled: !!user && !!game?.channelName,
    refetchInterval: 30_000,
  });

  const drawMutation = useMutation({
    mutationFn: async (number: number) => {
      const r = await fetch(`${API}/games/${id}/numbers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Failed to draw number');
      }
      return r.json();
    },
    onSuccess: (_, number) => {
      toast.success(t('numberDrawnSuccess', { number }));
      setNumberInput('');
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['cards', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (number: number) => {
      const r = await fetch(`${API}/games/${id}/numbers/${number}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Failed to remove number');
      }
    },
    onSuccess: () => {
      toast.success(t('numberRemoved'));
      setNumberInput('');
      void qc.invalidateQueries({ queryKey: ['game', id] });
      void qc.invalidateQueries({ queryKey: ['cards', id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeWinnerMutation = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch(`${API}/games/${id}/winners/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || t('removeWinnerError'));
      }
    },
    onSuccess: () => {
      toast.success(t('winnerRemoved'));
      void qc.invalidateQueries({ queryKey: ['winners', id] });
      void qc.invalidateQueries({ queryKey: ['cards', id] });
    },
    onError: (e: Error) => toast.error(e.message),
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
    socket.on('winner:removed', () => void qc.invalidateQueries({ queryKey: ['winners', id] }));
    return () => {
      socket.off('number:drawn');
      socket.off('number:removed');
      socket.off('winner:added');
      socket.off('winner:removed');
    };
  }, [socket, id, qc]);

  const drawnNumbers = (game?.drawnNumbers ?? []).map((d: { number: number }) => d.number);
  const winnerIds = new Set((winners ?? []).map((w: { userId: string }) => w.userId));

  const processedCards = (cards ?? [])
    .filter((c) => c.user?.displayName?.toLowerCase().includes(search.toLowerCase()))
    .map((c) => ({
      ...c,
      score: proximityScore(c.marked ?? Array(5).fill(Array(5).fill(false))),
    }))
    .sort((a, b) =>
      sortBy === 'proximity' ? a.score - b.score : a.user.displayName.localeCompare(b.user.displayName),
    );

  const handleDraw = () => {
    const n = parseInt(numberInput, 10);
    if (n >= 1 && n <= 75) drawMutation.mutate(n);
    else toast.error(t('numberRangeError'));
  };

  const handleRemove = () => {
    const n = parseInt(numberInput, 10);
    if (n >= 1 && n <= 75) removeMutation.mutate(n);
    else toast.error(t('numberRangeError'));
  };

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-24 w-full mb-4" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <a
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Dashboard
          </a>
          <h1 className="text-xl font-bold">{t('title')}</h1>
          {game && (
            <>
              <Badge variant={game.status === 'RUNNING' ? 'default' : 'secondary'}>
                {game.status === 'RUNNING' ? tb('gameRunning') : tb('gameStopped')}
              </Badge>
              <span className="text-sm text-muted-foreground">{game.title}</span>
            </>
          )}
          {/* Game switcher: shown when multiple games are available */}
          {availableGames && availableGames.length > 1 && (
            <Select value={id} onValueChange={(val) => router.push(`/moderator/${val}`)}>
              <SelectTrigger className="h-8 w-auto max-w-[220px] text-xs gap-1">
                <SelectValue placeholder={t('switchGame')} />
              </SelectTrigger>
              <SelectContent>
                {availableGames.map((g) => (
                  <SelectItem key={g.id} value={g.id} className="text-xs">
                    {g.channelName}{g.title && g.title !== g.channelName ? ` – ${g.title}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {game && (
            <div className="ml-auto flex items-center gap-1.5 text-xs">
              {botJoinStatus?.botJoined ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400 font-medium">{t('botJoined')}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-muted-foreground">{t('botNotJoined')}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Draw / remove panel */}
        <Card>
          <CardHeader><CardTitle className="text-base">{t('drawNumber')}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 items-center">
            <Input
              type="number"
              min={1}
              max={75}
              placeholder={t('numberInput')}
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDraw()}
              className="max-w-[150px]"
            />
            <Button onClick={handleDraw} disabled={!numberInput || drawMutation.isPending}>
              {t('drawNumber')}
            </Button>
            <Button
              variant="outline"
              onClick={handleRemove}
              disabled={!numberInput || removeMutation.isPending}
            >
              {t('removeNumber')}
            </Button>
          </CardContent>
        </Card>

        <NumberBoard numbers={drawnNumbers} />

        {/* Winners with remove button */}
        {(winners ?? []).length > 0 && (
          <div className="w-full">
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('winners')}</h3>
            <div className="flex flex-col gap-2">
              {(winners ?? []).map((w: { position: number; claimedVia: string; userId: string; user: { id: string; displayName: string; profileImageUrl?: string } }) => (
                <div key={w.position} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                  <span className="text-xl">{['🥇','🥈','🥉'][w.position - 1] || `#${w.position}`}</span>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={w.user.profileImageUrl} alt={w.user.displayName} />
                    <AvatarFallback>{w.user.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm flex-1">{w.user.displayName}</span>
                  <Badge variant="outline" className="text-xs">{w.claimedVia}</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeWinnerMutation.mutate(w.user.id)}
                    disabled={removeWinnerMutation.isPending}
                    title={t('removeWinner')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat commands collapsible */}
        <Card>
          <CardHeader
            className="py-2 px-4 cursor-pointer select-none"
            onClick={() => setShowCmds((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('chatCommands')}</CardTitle>
              {showCmds ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {showCmds && (
            <CardContent className="pt-0">
              {botCmds ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(botCmds).map(([slug, cfg]) => (
                    <div key={slug} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${!cfg.enabled ? 'opacity-40' : ''}`}>
                      <code className="font-mono font-semibold text-primary">{cfg.name}</code>
                      <span className="text-muted-foreground flex-1">{t(`cmd_${slug}` as Parameters<typeof t>[0])}</span>
                      <Badge variant="outline" className="text-xs">{cfg.perm}</Badge>
                      {!cfg.enabled && <Badge variant="secondary" className="text-xs">off</Badge>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
              )}
            </CardContent>
          )}
        </Card>

        {/* Card grid */}
        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold">
              {t('allCards')} ({processedCards.length})
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant={sortBy === 'proximity' ? 'default' : 'outline'}
                onClick={() => setSortBy('proximity')}
              >
                {t('sortByProximity')}
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'name' ? 'default' : 'outline'}
                onClick={() => setSortBy('name')}
              >
                {t('sortByName')}
              </Button>
              <Input
                placeholder={t('search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:max-w-[180px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {processedCards.map((c) => {
              const isWinner = winnerIds.has(c.user.id);
              return (
                <Card
                  key={c.id}
                  className={`overflow-hidden transition-colors ${isWinner ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950' : ''}`}
                >
                  <div className="py-2 px-3 flex flex-row items-center gap-2">
                    <Avatar className="h-6 w-6 flex-shrink-0">
                      <AvatarImage src={c.user.profileImageUrl} alt={c.user.displayName} />
                      <AvatarFallback>{c.user.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate flex-1">{c.user.displayName}</span>
                    {isWinner && (
                      <Trophy className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                  <CardContent className="px-2 pb-2">
                    {/* Mini 5x5 bingo card */}
                    <div className="grid grid-cols-5 gap-0.5">
                      {(c.grid ?? []).flat().map((num, idx) => {
                        const row = Math.floor(idx / 5);
                        const col = idx % 5;
                        const isMarked = c.marked?.[row]?.[col] ?? false;
                        const isCenter = row === 2 && col === 2;
                        return (
                          <div
                            key={idx}
                            className={`
                              aspect-square flex items-center justify-center text-xs font-semibold rounded-sm
                              ${isCenter ? 'bg-primary/30 text-primary' : isMarked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                            `}
                          >
                            {isCenter ? '★' : num ?? ''}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {processedCards.length === 0 && (
              <p className="text-muted-foreground col-span-full text-center py-8">
                {t('noCardsFound')}
              </p>
            )}
          </div>
        </div>
      </main>

      {/* Floating help button */}
      <button
        onClick={() => setHelpOpen(!helpOpen)}
        className={`fixed right-6 z-50 w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg flex items-center justify-center transition-all duration-300 ${
          cookieBannerVisible ? 'bottom-[4.5rem]' : 'bottom-6'
        } ${helpOpen ? 'ring-2 ring-white/50' : ''}`}
        title={helpOpen ? t('helpClose') : t('helpOpen')}
        aria-label={helpOpen ? t('helpClose') : t('helpOpen')}
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* Help side panel */}
      {helpOpen && (
        <div
          className="fixed right-0 z-30 flex flex-col bg-background border-l shadow-2xl"
          style={{ top: '3.5rem', bottom: 0, width: 'min(480px, 90vw)' }}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="font-semibold text-base">{t('helpTitle')}</h2>
            <button
              onClick={() => setHelpOpen(false)}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t('helpClose')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5 text-sm">
            <ModHelpSection step={1} title={t('helpStep1Title')} text={t('helpStep1Text')} />
            <ModHelpSection step={2} title={t('helpStep2Title')} text={t('helpStep2Text')} />
            <ModHelpSection step={3} title={t('helpStep3Title')} text={t('helpStep3Text')} />
            <ModHelpSection step={4} title={t('helpStep4Title')} text={t('helpStep4Text')} />
            <ModHelpSection step={5} title={t('helpStep5Title')} text={t('helpStep5Text')} />
            <div className="mt-2 rounded-md bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 px-4 py-3 text-muted-foreground text-xs">
              {t('helpFooter')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModHelpSection({ step, title, text }: { step: number; title: string; text: string }) {
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


