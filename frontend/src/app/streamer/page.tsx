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

const API = process.env.NEXT_PUBLIC_API_URL!;

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
    autoStopEnabled: false,
    autoStopEod: false,
    autoStopAt: '',
  });

  useEffect(() => {
    if (!authLoading && user && !['STREAMER', 'ADMIN'].includes(user.role)) router.replace('/dashboard');
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: games } = useQuery({
    queryKey: ['my-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/games?limit=20`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/bingo`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title || 'Bingo',
          channelName: form.channelName,
          maxWinners: form.maxWinners,
          autoStopEnabled: form.autoStopEnabled,
          autoStopEod: form.autoStopEod,
          autoStopAt: form.autoStopAt || null,
        }),
      });
      if (!r.ok) throw new Error('Failed to create game');
      return r.json();
    },
    onSuccess: (data) => {
      toast.success('Spiel erstellt!');
      void qc.invalidateQueries({ queryKey: ['my-games'] });
      router.push(`/game/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const startMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const r = await fetch(`${API}/bingo/${gameId}/start`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Failed to start game');
      return r.json();
    },
    onSuccess: () => {
      toast.success('Spiel gestartet!');
      void qc.invalidateQueries({ queryKey: ['my-games'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const stopMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const r = await fetch(`${API}/bingo/${gameId}/stop`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Failed to stop game');
      return r.json();
    },
    onSuccess: () => {
      toast.success('Spiel beendet!');
      void qc.invalidateQueries({ queryKey: ['my-games'] });
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-8 max-w-3xl">
        <h1 className="text-2xl font-bold">🎬 Streamer-Verwaltung</h1>

        {/* Create game form */}
        <Card>
          <CardHeader><CardTitle>{t('createGame')}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="title">{t('gameTitle')}</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Mein Bingo" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="channel">{t('channelName')}</Label>
                <Input id="channel" value={form.channelName} onChange={(e) => setForm({ ...form, channelName: e.target.value })} placeholder="dein_twitch_name" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="maxWinners">{t('maxWinners')}</Label>
                <Input id="maxWinners" type="number" min={1} max={20} value={form.maxWinners} onChange={(e) => setForm({ ...form, maxWinners: parseInt(e.target.value, 10) })} />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="autoStop">{t('autoStop')}</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={form.autoStopEnabled} onCheckedChange={(v) => setForm({ ...form, autoStopEnabled: v })} id="autoStop" />
                  <span className="text-sm text-muted-foreground">aktivieren</span>
                </div>
              </div>
            </div>
            {form.autoStopEnabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="autoStopAt">{t('autoStopAt')}</Label>
                  <Input id="autoStopAt" type="datetime-local" value={form.autoStopAt} onChange={(e) => setForm({ ...form, autoStopAt: e.target.value })} />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <Switch checked={form.autoStopEod} onCheckedChange={(v) => setForm({ ...form, autoStopEod: v })} id="autoStopEod" />
                  <Label htmlFor="autoStopEod">{t('autoStopEod')}</Label>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {t('createGame')}
            </Button>
          </CardFooter>
        </Card>

        {/* Game list */}
        <div className="flex flex-col gap-3">
          <h2 className="font-semibold text-lg">Meine Spiele</h2>
          {(Array.isArray(games) ? games : games?.data ?? []).map((g: {
            id: string;
            title: string;
            status: string;
          }) => (
            <Card key={g.id}>
              <CardContent className="flex items-center justify-between py-3 px-4 flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{g.title}</span>
                  <Badge variant={g.status === 'RUNNING' ? 'default' : g.status === 'CREATED' ? 'outline' : 'secondary'}>
                    {g.status === 'RUNNING' ? tb('gameRunning') : g.status}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {g.status === 'CREATED' && (
                    <Button size="sm" onClick={() => startMutation.mutate(g.id)}>{t('startGame')}</Button>
                  )}
                  {g.status === 'RUNNING' && (
                    <>
                      <Button size="sm" variant="outline" asChild>
                        <a href={`/moderator/${g.id}`}>Moderieren</a>
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => stopMutation.mutate(g.id)}>{t('stopGame')}</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <a href={`/game/${g.id}`}>Anzeigen</a>
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
