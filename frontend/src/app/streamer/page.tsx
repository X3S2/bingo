'use client';

import { useAuth } from '@/providers/auth-provider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Navbar } from '@/components/navigation/navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Users, Hash, Wifi } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL!;

interface Game {
  id: string;
  title: string;
  channelName: string;
  status: 'CREATED' | 'RUNNING' | 'STOPPED';
  createdAt: string;
  _count?: { cards: number; winners: number; drawnNumbers: number };
}

export default function StreamerPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('streamer');
  const tb = useTranslations('bingo');

  const [form, setForm] = useState({
    title: '',
    channelName: '',
    maxWinners: 3,
    autoStopEnabled: true,
    autoStopEod: true,
    autoStopAt: '',
  });

  useEffect(() => {
    if (!authLoading && user && !['STREAMER', 'ADMIN'].includes(user.role)) router.replace('/dashboard');
    if (!authLoading && !user) router.replace('/login');
    // Pre-fill channel name from user's display name
    if (user?.displayName && !form.channelName) {
      setForm((f) => ({ ...f, channelName: user.displayName.toLowerCase() }));
    }
  }, [user, authLoading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: games } = useQuery<Game[]>({
    queryKey: ['my-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/my-games`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title: form.title || 'Bingo',
        channelName: form.channelName,
        maxWinners: form.maxWinners,
        autoStopEnabled: form.autoStopEnabled,
        autoStopEod: form.autoStopEod,
      };
      if (form.autoStopEnabled && form.autoStopAt) {
        body.autoStopAt = form.autoStopAt;
      }
      const r = await fetch(`${API}/games`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Failed to create game');
      }
      return r.json();
    },
    onSuccess: (data: Game) => {
      toast.success('Spiel erstellt!');
      setForm((f) => ({ ...f, title: '' }));
      void qc.invalidateQueries({ queryKey: ['my-games'] });
      router.push(`/moderator/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const r = await fetch(`${API}/games/${gameId}/start`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Failed to start game');
      }
      return r.json();
    },
    onSuccess: (data: Game) => {
      toast.success('Spiel gestartet!');
      void qc.invalidateQueries({ queryKey: ['my-games'] });
      triggerBotJoin(data.channelName);
      router.push(`/moderator/${data.id}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const r = await fetch(`${API}/games/${gameId}/stop`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.message || 'Failed to stop game');
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success('Spiel beendet!');
      void qc.invalidateQueries({ queryKey: ['my-games'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const triggerBotJoin = (channelName: string) => {
    void fetch(`${API}/twitch/bot-join`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName }),
    }).then(async (r) => {
      const d = await r.json();
      if (d.success) toast.success(d.message);
      else toast.error(d.message);
    }).catch(() => { /* ignore */ });
  };

  const botJoinMutation = useMutation({
    mutationFn: async (channelName: string) => {
      const r = await fetch(`${API}/twitch/bot-join`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName }),
      });
      return r.json();
    },
    onSuccess: (d) => { if (d.success) toast.success(d.message); else toast.error(d.message); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyLink = (gameId: string) => {
    const origin = window.location.origin;
    void navigator.clipboard.writeText(`${origin}/game/${gameId}`).then(() => {
      toast.success('Link kopiert!');
    });
  };

  if (authLoading || !user || !['STREAMER', 'ADMIN'].includes(user.role)) return null;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-8 max-w-3xl">
        <div className="flex items-center gap-4 mb-2">
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Dashboard</a>
          <h1 className="text-2xl font-bold">🎦 {t('title')}</h1>
        </div>

        {/* Create game form */}
        <Card>
          <CardHeader><CardTitle>{t('createGame')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="title">{t('gameTitle')}</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Mein Bingo"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="channel">{t('channelName')}</Label>
                <Input
                  id="channel"
                  value={form.channelName}
                  onChange={(e) => setForm({ ...form, channelName: e.target.value })}
                  placeholder="dein_twitch_name"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="maxWinners">{t('maxWinners')}</Label>
                <Input
                  id="maxWinners"
                  type="number"
                  min={1}
                  max={20}
                  value={form.maxWinners}
                  onChange={(e) => setForm({ ...form, maxWinners: parseInt(e.target.value, 10) })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="autoStop">{t('autoStop')}</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch
                    checked={form.autoStopEnabled}
                    onCheckedChange={(v) => setForm({ ...form, autoStopEnabled: v })}
                    id="autoStop"
                  />
                  <span className="text-sm text-muted-foreground">{t('enable')}</span>
                </div>
              </div>
            </div>
            {form.autoStopEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="autoStopAt">{t('autoStopAt')}</Label>
                  <Input
                    id="autoStopAt"
                    type="datetime-local"
                    value={form.autoStopAt}
                    onChange={(e) => setForm({ ...form, autoStopAt: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <Switch
                    checked={form.autoStopEod}
                    onCheckedChange={(v) => setForm({ ...form, autoStopEod: v })}
                    id="autoStopEod"
                  />
                  <Label htmlFor="autoStopEod">{t('autoStopEod')}</Label>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.channelName}
            >
              {createMutation.isPending ? t('creating') : t('createGame')}
            </Button>
          </CardFooter>
        </Card>

        {/* Game list */}
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg">{t('myGames')}</h2>
          {(games ?? []).length === 0 && (
            <p className="text-muted-foreground text-sm">{t('noGames')}</p>
          )}
          {(games ?? []).map((g) => (
            <Card key={g.id}>
              <CardContent className="flex items-center justify-between py-3 px-4 flex-wrap gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{g.title}</span>
                    <Badge
                      variant={
                        g.status === 'RUNNING' ? 'default' : g.status === 'CREATED' ? 'outline' : 'secondary'
                      }
                    >
                      {g.status === 'RUNNING' ? tb('gameRunning') : g.status === 'CREATED' ? tb('gameCreated') : tb('gameStopped')}
                    </Badge>
                  </div>
                  {g._count && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{g._count.cards} {t('cards')}</span>
                      <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{g._count.drawnNumbers} {t('numbers')}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {g.status === 'CREATED' && (
                    <Button size="sm" onClick={() => startMutation.mutate(g.id)} disabled={startMutation.isPending}>
                      {t('startGame')}
                    </Button>
                  )}
                  {g.status === 'RUNNING' && (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/moderator/${g.id}`}>{t('moderate')}</a>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => botJoinMutation.mutate(g.channelName)}
                        disabled={botJoinMutation.isPending}
                        title={t('botJoin')}
                      >
                        <Wifi className="w-3 h-3 mr-1" />{t('botJoin')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => stopMutation.mutate(g.id)}
                        disabled={stopMutation.isPending}
                      >
                        {t('stopGame')}
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => copyLink(g.id)} title="Link kopieren">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" asChild title="Spiel öffnen">
                    <a href={`/game/${g.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}


