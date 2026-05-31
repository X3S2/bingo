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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Copy, ExternalLink, Users, Hash, Wifi, ChevronDown, ChevronUp, Gift, Zap, AlertTriangle, HelpCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL!;

interface Game {
  id: string;
  title: string;
  channelName: string;
  status: 'CREATED' | 'RUNNING' | 'STOPPED';
  createdAt: string;
  _count?: { cards: number; winners: number; drawnNumbers: number };
}

interface CpSettings {
  mode: 'auto' | 'manual';
  selfEnabled: boolean;
  selfName: string;
  selfCost: number;
  selfMaxPerUser: number;
  selfMaxPerStream: number;
  selfRewardId?: string;
  giftEnabled: boolean;
  giftName: string;
  giftCost: number;
  giftMaxPerUser: number;
  giftMaxPerStream: number;
  giftRewardId?: string;
  configured?: boolean;
}

const DEFAULT_CP: CpSettings = {
  mode: 'auto',
  selfEnabled: true,
  selfName: 'StreamBingoKarte',
  selfCost: 5000,
  selfMaxPerUser: 1,
  selfMaxPerStream: -1,
  giftEnabled: false,
  giftName: 'StreamBingoKarte verschenken',
  giftCost: 5000,
  giftMaxPerUser: -1,
  giftMaxPerStream: -1,
};

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

  const [cpSettings, setCpSettings] = useState<CpSettings>(DEFAULT_CP);
  const [cpOpen, setCpOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user && !['STREAMER', 'ADMIN'].includes(user.role)) router.replace('/dashboard');
    if (!authLoading && !user) router.replace('/login');
    // Pre-fill channel name from user's display name
    if (user?.displayName && !form.channelName) {
      setForm((f) => ({ ...f, channelName: user.displayName.toLowerCase() }));
    }
  }, [user, authLoading, router]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-open settings when user has never created a game
  // NOTE: must be declared AFTER the useQuery that provides `games`

  const { data: games } = useQuery<Game[]>({
    queryKey: ['my-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/games/my-games`, { credentials: 'include' });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (games !== undefined && games.length === 0) {
      setCpOpen(true);
    }
  }, [games]);

  const { data: cpData } = useQuery<CpSettings>({
    queryKey: ['cp-settings'],
    queryFn: async () => {
      const r = await fetch(`${API}/twitch/rewards/settings`, { credentials: 'include' });
      if (!r.ok) return DEFAULT_CP;
      return r.json();
    },
    enabled: !!user && ['STREAMER', 'ADMIN'].includes(user?.role ?? ''),
  });

  useEffect(() => {
    if (cpData) setCpSettings(cpData);
  }, [cpData]);

  const saveCpMutation = useMutation({
    mutationFn: async (settings: CpSettings) => {
      const r = await fetch(`${API}/twitch/rewards/settings`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message || 'Fehler'); }
      return r.json();
    },
    onSuccess: () => {
      toast.success(t('cpSettingsSaved'));
      setCpSettings((s) => ({ ...s, configured: true }));
      void qc.invalidateQueries({ queryKey: ['cp-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setupRewardsMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/twitch/rewards/setup`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.message || 'Fehler'); }
      return r.json();
    },
    onSuccess: (data: { warnings?: string[] }) => {
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach((w) => toast.warning(w));
      } else {
        toast.success(t('cpSetupSuccess'));
      }
      void qc.invalidateQueries({ queryKey: ['cp-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  // True if settings have been saved & rewards are ready (or games already exist)
  const rewardsConfigured = cpSettings.configured === true || (games?.length ?? 0) > 0;
  // Draw attention to settings card when first-time user hasn't configured yet
  const showAttention = !rewardsConfigured && games !== undefined && games.length === 0;

  const [helpOpen, setHelpOpen] = useState(false);

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

        {/* Allgemeine Einstellungen – Channel Points */}
        <Card className={showAttention ? 'border-amber-500 shadow-amber-500/20 shadow-md' : ''}>
          <CardHeader
            className="py-3 px-4 cursor-pointer select-none"
            onClick={() => setCpOpen((v) => !v)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className={`w-4 h-4 ${showAttention ? 'text-amber-500 animate-bounce' : 'text-yellow-500'}`} />
                {t('generalSettings')}
                {showAttention && (
                  <span className="text-xs font-normal text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    {t('cpSetupNeeded')}
                  </span>
                )}
              </CardTitle>
              {cpOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardHeader>
          {cpOpen && (
            <CardContent className="flex flex-col gap-5">
              {/* Mode toggle */}
              <div className="flex items-center gap-3">
                <Switch
                  id="cp-mode"
                  checked={cpSettings.mode === 'auto'}
                  onCheckedChange={(v) => setCpSettings((s) => ({ ...s, mode: v ? 'auto' : 'manual' }))}
                />
                <Label htmlFor="cp-mode" className="cursor-pointer">
                  {cpSettings.mode === 'auto' ? t('cpModeAuto') : t('cpModeManual')}
                </Label>
              </div>

              {cpSettings.mode === 'manual' ? (
                <div className="flex flex-col gap-3">
                  {/* Name fields so streamer knows exactly what to enter on Twitch */}
                  <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <p className="text-sm font-semibold">{t('cpSelfReward')}</p>
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="cp-self-name-manual">{t('cpRewardName')}</Label>
                      <Input
                        id="cp-self-name-manual"
                        value={cpSettings.selfName}
                        onChange={(e) => setCpSettings((s) => ({ ...s, selfName: e.target.value }))}
                        maxLength={45}
                      />
                    </div>
                  </div>
                  {cpSettings.giftEnabled && (
                    <div className="flex flex-col gap-3 rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="cp-gift-enabled-manual"
                          checked={cpSettings.giftEnabled}
                          onCheckedChange={(v) => setCpSettings((s) => ({ ...s, giftEnabled: v }))}
                        />
                        <Label htmlFor="cp-gift-enabled-manual" className="cursor-pointer flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5" />
                          {t('cpGiftReward')}
                        </Label>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cp-gift-name-manual">{t('cpRewardName')}</Label>
                        <Input
                          id="cp-gift-name-manual"
                          value={cpSettings.giftName}
                          onChange={(e) => setCpSettings((s) => ({ ...s, giftName: e.target.value }))}
                          maxLength={45}
                        />
                      </div>
                    </div>
                  )}
                  {/* Step-by-step instructions */}
                  <div className="rounded-md bg-muted p-3 flex flex-col gap-1.5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{t('cpManualHintTitle')}</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>{t('cpManualStep1')}</li>
                      <li>{t('cpManualStep2')}</li>
                      <li>{t('cpManualStep3a')} <strong className="font-mono text-foreground">{cpSettings.selfName}</strong> {t('cpManualStep3b')}</li>
                      <li>{t('cpManualStep4')}</li>
                      <li>{t('cpManualStep5')}</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <>
                  {/* SELF reward settings */}
                  <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <p className="text-sm font-semibold">{t('cpSelfReward')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex flex-col gap-1 sm:col-span-2">
                        <Label htmlFor="cp-self-name">{t('cpRewardName')}</Label>
                        <Input
                          id="cp-self-name"
                          value={cpSettings.selfName}
                          onChange={(e) => setCpSettings((s) => ({ ...s, selfName: e.target.value }))}
                          maxLength={45}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cp-self-cost">{t('cpRewardCost')}</Label>
                        <Input
                          id="cp-self-cost"
                          type="number"
                          min={1}
                          value={cpSettings.selfCost}
                          onChange={(e) => setCpSettings((s) => ({ ...s, selfCost: parseInt(e.target.value, 10) || 1 }))}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cp-self-max-user">{t('cpMaxPerUser')}</Label>
                        <Input
                          id="cp-self-max-user"
                          type="number"
                          min={-1}
                          value={cpSettings.selfMaxPerUser}
                          onChange={(e) => setCpSettings((s) => ({ ...s, selfMaxPerUser: parseInt(e.target.value, 10) || -1 }))}
                        />
                        <p className="text-xs text-muted-foreground">{t('cpMaxHint')}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="cp-self-max-stream">{t('cpMaxPerStream')}</Label>
                        <Input
                          id="cp-self-max-stream"
                          type="number"
                          min={-1}
                          value={cpSettings.selfMaxPerStream}
                          onChange={(e) => setCpSettings((s) => ({ ...s, selfMaxPerStream: parseInt(e.target.value, 10) || -1 }))}
                        />
                        <p className="text-xs text-muted-foreground">{t('cpMaxHint')}</p>
                      </div>
                    </div>
                    {cpSettings.selfRewardId && (
                      <p className="text-xs text-muted-foreground">Twitch ID: {cpSettings.selfRewardId}</p>
                    )}
                  </div>

                  {/* GIFT reward settings */}
                  <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="cp-gift-enabled"
                        checked={cpSettings.giftEnabled}
                        onCheckedChange={(v) => setCpSettings((s) => ({ ...s, giftEnabled: v }))}
                      />
                      <Label htmlFor="cp-gift-enabled" className="cursor-pointer flex items-center gap-1.5">
                        <Gift className="w-3.5 h-3.5" />
                        {t('cpGiftReward')}
                      </Label>
                    </div>
                    {cpSettings.giftEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <Label htmlFor="cp-gift-name">{t('cpRewardName')}</Label>
                          <Input
                            id="cp-gift-name"
                            value={cpSettings.giftName}
                            onChange={(e) => setCpSettings((s) => ({ ...s, giftName: e.target.value }))}
                            maxLength={45}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cp-gift-cost">{t('cpRewardCost')}</Label>
                          <Input
                            id="cp-gift-cost"
                            type="number"
                            min={1}
                            value={cpSettings.giftCost}
                            onChange={(e) => setCpSettings((s) => ({ ...s, giftCost: parseInt(e.target.value, 10) || 1 }))}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cp-gift-max-user">{t('cpMaxPerUser')}</Label>
                          <Input
                            id="cp-gift-max-user"
                            type="number"
                            min={-1}
                            value={cpSettings.giftMaxPerUser}
                            onChange={(e) => setCpSettings((s) => ({ ...s, giftMaxPerUser: parseInt(e.target.value, 10) || -1 }))}
                          />
                          <p className="text-xs text-muted-foreground">{t('cpMaxHint')}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="cp-gift-max-stream">{t('cpMaxPerStream')}</Label>
                          <Input
                            id="cp-gift-max-stream"
                            type="number"
                            min={-1}
                            value={cpSettings.giftMaxPerStream}
                            onChange={(e) => setCpSettings((s) => ({ ...s, giftMaxPerStream: parseInt(e.target.value, 10) || -1 }))}
                          />
                          <p className="text-xs text-muted-foreground">{t('cpMaxHint')}</p>
                        </div>
                        {cpSettings.giftRewardId && (
                          <p className="text-xs text-muted-foreground sm:col-span-3">Twitch ID: {cpSettings.giftRewardId}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Setup button */}
                  <Button
                    variant="outline"
                    onClick={() => setupRewardsMutation.mutate()}
                    disabled={setupRewardsMutation.isPending}
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    {t('cpSetupButton')}
                  </Button>
                </>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={() => saveCpMutation.mutate(cpSettings)}
                  disabled={saveCpMutation.isPending}
                >
                  {t('saveSettings')}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Create game form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle>{t('createGame')}</CardTitle>
              {!rewardsConfigured && games !== undefined && (
                <span className="flex items-center gap-1 text-xs text-destructive font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('cpSettingsRequired')}
                </span>
              )}
            </div>
          </CardHeader>
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
                  disabled
                  className="opacity-60 cursor-not-allowed"
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
              disabled={createMutation.isPending || !form.channelName || !rewardsConfigured}
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
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white gap-1.5" onClick={() => copyLink(g.id)} title={t('copyLink')}>
                    <Copy className="w-4 h-4 flex-shrink-0" />
                    <span className="hidden sm:inline">{t('copyLink')}</span>
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

      {/* Floating help button */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg flex items-center justify-center transition-colors"
        title={t('helpOpen')}
        aria-label={t('helpOpen')}
      >
        <HelpCircle className="w-6 h-6" />
      </button>

      {/* Help side panel */}
      <Sheet open={helpOpen} onOpenChange={setHelpOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('helpTitle')}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-5 text-sm">
            <HelpSection step={1} title={t('helpStep1Title')} text={t('helpStep1Text')} />
            <HelpSection step={2} title={t('helpStep2Title')} text={t('helpStep2Text')} />
            <HelpSection step={3} title={t('helpStep3Title')} text={t('helpStep3Text')} />
            <HelpSection step={4} title={t('helpStep4Title')} text={t('helpStep4Text')} />
            <HelpSection step={5} title={t('helpStep5Title')} text={t('helpStep5Text')} />
            <div className="mt-2 rounded-md bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800 px-4 py-3 text-muted-foreground text-xs">
              {t('helpFooter')}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function HelpSection({ step, title, text }: { step: number; title: string; text: string }) {
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


