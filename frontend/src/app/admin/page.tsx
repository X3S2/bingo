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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Wifi, WifiOff, ShieldCheck, ShieldX } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL!;

const ROLES = ['VIEWER', 'MODERATOR', 'STREAMER', 'ADMIN'] as const;

interface AdminUser {
  id: string;
  displayName: string;
  profileImageUrl?: string;
  role: string;
  isBanned: boolean;
  bannedReason?: string;
  createdAt: string;
}

interface AdminGame {
  id: string;
  title: string;
  channelName: string;
  status: string;
  createdAt: string;
  _count?: { cards: number; drawnNumbers: number; winners: number };
}

interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  targetType?: string;
  targetId?: string;
  metadata?: unknown;
  createdAt: string;
  admin?: { displayName: string };
}

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('admin');
  const tb = useTranslations('bot');
  const tbi = useTranslations('bingo');
  const tc = useTranslations('common');

  useEffect(() => {
    if (!authLoading && user && user.role !== 'ADMIN') router.replace('/dashboard');
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/stats`, { credentials: 'include' });
      return r.json();
    },
    enabled: !!user,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/users?limit=100`, { credentials: 'include' });
      return r.json();
    },
    enabled: !!user,
  });

  const { data: gamesData, isLoading: gamesLoading } = useQuery({
    queryKey: ['admin-games'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/games?limit=50`, { credentials: 'include' });
      return r.json();
    },
    enabled: !!user,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/audit-log?limit=50`, { credentials: 'include' });
      return r.json();
    },
    enabled: !!user,
  });

  const { data: botStatus, refetch: refetchBotStatus } = useQuery({
    queryKey: ['admin-bot-status'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/bot-status`, { credentials: 'include' });
      return r.json();
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const { data: settings } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/settings`, { credentials: 'include' });
      return r.json();
    },
    enabled: !!user,
  });

  const [maintenanceMsg, setMaintenanceMsg] = useState('');
  const [impressumText, setImpressumText] = useState('');
  const [impressumEnText, setImpressumEnText] = useState('');
  const [datenschutzText, setDatenschutzText] = useState('');
  const [datenschutzEnText, setDatenschutzEnText] = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (settings) {
      setMaintenanceMsg(settings.find((s: { key: string }) => s.key === 'maintenance_message')?.value ?? '');
      setImpressumText(settings.find((s: { key: string }) => s.key === 'impressum')?.value ?? '');
      setImpressumEnText(settings.find((s: { key: string }) => s.key === 'impressum_en')?.value ?? '');
      setDatenschutzText(settings.find((s: { key: string }) => s.key === 'datenschutz')?.value ?? '');
      setDatenschutzEnText(settings.find((s: { key: string }) => s.key === 'datenschutz_en')?.value ?? '');
    }
  }, [settings]);

  const banMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: 'ban' | 'unban' }) => {
      const r = await fetch(`${API}/admin/users/${userId}/${action}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => {
      toast.success('Nutzer aktualisiert');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const r = await fetch(`${API}/admin/users/${userId}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!r.ok) throw new Error('Failed to change role');
      return r.json();
    },
    onSuccess: (_, { role }) => {
      toast.success(`${t('changeRole')}: ${role}`);
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stopGameMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const r = await fetch(`${API}/admin/games/${gameId}/stop`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Failed to stop game');
      return r.json();
    },
    onSuccess: () => {
      toast.success(t('stopGame'));
      void qc.invalidateQueries({ queryKey: ['admin-games'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const r = await fetch(`${API}/admin/maintenance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, message: maintenanceMsg }),
      });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => toast.success(t('maintenance')),
    onError: (e: Error) => toast.error(e.message),
  });

  const botRefreshMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/bot-refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Refresh fehlgeschlagen');
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Token-Refresh angefordert');
      void refetchBotStatus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const r = await fetch(`${API}/admin/settings/${key}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!r.ok) throw new Error('Failed');
      return r.json();
    },
    onSuccess: () => {
      toast.success(tc('save'));
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const maintenanceEnabled = settings?.find((s: { key: string }) => s.key === 'maintenance_enabled')?.value === 'true';

  const users: AdminUser[] = Array.isArray(usersData) ? usersData : usersData?.users ?? [];
  const games: AdminGame[] = Array.isArray(gamesData) ? gamesData : gamesData?.games ?? [];
  const auditEntries: AuditEntry[] = Array.isArray(auditData) ? auditData : auditData?.logs ?? [];

  const filteredUsers = users.filter((u) =>
    u.displayName.toLowerCase().includes(userSearch.toLowerCase()),
  );

  if (authLoading || !user || user.role !== 'ADMIN') return null;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-2">
          <a href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">← Dashboard</a>
          <h1 className="text-2xl font-bold">⚙️ {t('title')}</h1>
        </div>

        <Tabs defaultValue="stats">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="stats">{t('stats')}</TabsTrigger>
            <TabsTrigger value="users">{t('users')}</TabsTrigger>
            <TabsTrigger value="games">{t('games')}</TabsTrigger>
            <TabsTrigger value="bot">🤖 Bot</TabsTrigger>
            <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
            <TabsTrigger value="audit">{t('auditLog')}</TabsTrigger>
          </TabsList>

          {/* Stats */}
          <TabsContent value="stats" className="mt-4">
            {stats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: t('totalUsers'), value: stats.totalUsers },
                  { label: t('totalGames'), value: stats.totalGames },
                  { label: t('activeGames'), value: stats.activeGames },
                  { label: t('totalWinners'), value: stats.totalWinners },
                ].map((s) => (
                  <Card key={s.label}>
                    <CardContent className="pt-4">
                      <p className="text-3xl font-bold">{s.value ?? '—'}</p>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <p className="text-muted-foreground">{tc('loading')}</p>}
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="mt-4">
            <div className="flex flex-col gap-3">
              <Input
                placeholder={t('searchUsers')}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="max-w-xs"
              />
              {usersLoading && <p className="text-muted-foreground">{tc('loading')}</p>}
              {filteredUsers.map((u) => (
                <Card key={u.id}>
                  <CardContent className="flex items-center gap-3 py-3 px-4 flex-wrap">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={u.profileImageUrl} alt={u.displayName} />
                      <AvatarFallback>{u.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm flex-1 min-w-0 truncate">{u.displayName}</span>
                    <Badge variant="outline" className="flex-shrink-0">{u.role}</Badge>
                    {u.isBanned && <Badge variant="destructive" className="flex-shrink-0">{t('banned')}</Badge>}
                    <div className="flex gap-2 flex-wrap ml-auto">
                      {/* Role change */}
                      <Select
                        defaultValue={u.role}
                        onValueChange={(role) => roleMutation.mutate({ userId: u.id, role })}
                        disabled={u.id === user?.id}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Ban/unban */}
                      {u.isBanned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => banMutation.mutate({ userId: u.id, action: 'unban' })}
                          disabled={banMutation.isPending}
                        >
                          {t('unbanUser')}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => banMutation.mutate({ userId: u.id, action: 'ban' })}
                          disabled={banMutation.isPending || u.id === user?.id}
                        >
                          {t('banUser')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Games */}
          <TabsContent value="games" className="mt-4">
            <div className="flex flex-col gap-3">
              {gamesLoading && <p className="text-muted-foreground">{tc('loading')}</p>}
              {games.map((g) => (
                <Card key={g.id}>
                  <CardContent className="flex items-center gap-3 py-3 px-4 flex-wrap">
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{g.title}</span>
                        <Badge
                          variant={
                            g.status === 'RUNNING' ? 'default' : g.status === 'CREATED' ? 'outline' : 'secondary'
                          }
                        >
                          {g.status === 'RUNNING' ? tbi('gameRunning') : g.status === 'CREATED' ? tbi('gameCreated') : tbi('gameStopped')}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        #{g.channelName} — {g._count?.cards ?? 0} {t('cards')}, {g._count?.drawnNumbers ?? 0} {t('numbers')}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {g.status !== 'STOPPED' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => stopGameMutation.mutate(g.id)}
                          disabled={stopGameMutation.isPending}
                        >
                          {t('forceStop')}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" asChild>
                        <a href={`/game/${g.id}`} target="_blank" rel="noreferrer">{t('openGame')}</a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {games.length === 0 && !gamesLoading && (
                <p className="text-muted-foreground text-sm">{t('noGames')}</p>
              )}
            </div>
          </TabsContent>

          {/* Bot */}
          <TabsContent value="bot" className="mt-4 flex flex-col gap-4">
            {/* Bot Status Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  🤖 {tb('status')}
                  <Button size="sm" variant="ghost" onClick={() => void refetchBotStatus()} className="ml-auto h-7 px-2">
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </CardTitle>
                <CardDescription>{tb('connectionStatus')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {botStatus ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      {botStatus.connected
                        ? <Wifi className="w-4 h-4 text-green-500" />
                        : <WifiOff className="w-4 h-4 text-red-500" />}
                      <span className="font-medium">{tb('irc')}</span>
                      <Badge variant={botStatus.connected ? 'default' : 'destructive'} className="text-xs">
                        {botStatus.connected ? tb('connected') : tb('disconnected')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {botStatus.tokenValid
                        ? <ShieldCheck className="w-4 h-4 text-green-500" />
                        : <ShieldX className="w-4 h-4 text-red-500" />}
                      <span className="font-medium">{tb('token')}</span>
                      <Badge variant={botStatus.tokenValid ? 'default' : 'destructive'} className="text-xs">
                        {botStatus.tokenValid ? tb('valid') : tb('invalid')}
                      </Badge>
                    </div>
                    {botStatus.botLogin && (
                      <div className="col-span-2 text-muted-foreground">
                        {tb('botLogin')} <span className="font-mono font-medium text-foreground">@{botStatus.botLogin}</span>
                      </div>
                    )}
                    {botStatus.tokenValid && botStatus.tokenExpiresIn != null && (
                      <div className="col-span-2 text-muted-foreground">
                        {tb('expiresIn')}{' '}
                        {botStatus.tokenExpiresIn <= 0 ? (
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">{tb('expiringSoon')}</span>
                        ) : botStatus.tokenExpiresIn < 3600 ? (
                          <span className="font-medium text-yellow-600 dark:text-yellow-400">
                            {Math.floor(botStatus.tokenExpiresIn / 60)}min
                          </span>
                        ) : (
                          <span className="font-medium text-foreground">
                            {Math.floor(botStatus.tokenExpiresIn / 3600)}h {Math.floor((botStatus.tokenExpiresIn % 3600) / 60)}min
                          </span>
                        )}
                      </div>
                    )}
                    {botStatus.lastRefreshedAt && (
                      <div className="col-span-2 text-muted-foreground">
                        {tb('lastRefresh')} <span className="font-medium text-foreground">
                          {new Date(botStatus.lastRefreshedAt).toLocaleString('de-DE')}
                        </span>
                      </div>
                    )}
                    <div className="col-span-2 text-muted-foreground">
                      {tb('joinedChannels')}{' '}
                      {botStatus.joinedChannels?.length > 0
                        ? botStatus.joinedChannels.map((ch: string) => (
                            <span key={ch} className="font-mono font-medium text-foreground mr-2">#{ch}</span>
                          ))
                        : <span className="text-muted-foreground italic">{tb('noChannels')}</span>}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{tc('loading')}</p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => botRefreshMutation.mutate()}
                  disabled={botRefreshMutation.isPending}
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  {botRefreshMutation.isPending ? tb('refreshing') : tb('manualRefresh')}
                </Button>
              </CardContent>
            </Card>

            {/* Chat Commands */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">💬 {tb('chatCommands')}</CardTitle>
                <CardDescription>{tb('chatCommandsDesc')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3">
                  {[
                    {
                      cmd: '!zahl+N',
                      example: '!zahl+42',
                      who: 'Mod / Broadcaster',
                      desc: 'Zieht die Zahl N (1–75). Alle Bingo-Karten werden automatisch aktualisiert.',
                      color: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
                    },
                    {
                      cmd: '!zahl-N',
                      example: '!zahl-42',
                      who: 'Mod / Broadcaster',
                      desc: 'Entfernt die Zahl N wieder. Alle Karten werden zurückberechnet.',
                      color: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800',
                    },
                    {
                      cmd: 'bingo',
                      example: 'bingo',
                      who: 'Alle Zuschauer',
                      desc: 'Meldet Bingo. Der Bot prüft die Karte des Nutzers automatisch.',
                      color: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800',
                    },
                    {
                      cmd: '!buycard',
                      example: '!buycard',
                      who: 'Alle (Debug)',
                      desc: '⚙️ Debug-Befehl: Erstellt eine Bingo-Karte ohne Channel-Point-Redeem. Nützlich zum Testen. Jeder Nutzer kann nur eine Karte pro Spiel haben.',
                      color: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
                    },
                  ].map((c) => (
                    <div key={c.cmd} className={`rounded-lg border p-3 ${c.color}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="font-mono font-bold text-sm bg-background/60 px-2 py-0.5 rounded">{c.cmd}</code>
                          <span className="text-xs text-muted-foreground">Beispiel: <code className="font-mono">{c.example}</code></span>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{c.who}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-4 flex flex-col gap-4">            {/* Maintenance */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('maintenance')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={maintenanceEnabled}
                    onCheckedChange={(v) => maintenanceMutation.mutate(v)}
                    id="maintenance"
                  />
                  <Label htmlFor="maintenance">{t('maintenanceEnabled')}</Label>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('maintenanceMessage')}
                    value={maintenanceMsg}
                    onChange={(e) => setMaintenanceMsg(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => saveSettingMutation.mutate({ key: 'maintenance_message', value: maintenanceMsg })}
                  >
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Impressum */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('impressum')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Textarea
                  rows={8}
                  value={impressumText}
                  onChange={(e) => setImpressumText(e.target.value)}
                  placeholder="Impressum-Text (Markdown oder Plain-Text)..."
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => saveSettingMutation.mutate({ key: 'impressum', value: impressumText })}
                  disabled={saveSettingMutation.isPending}
                >
                  {tc('save')}
                </Button>
              </CardContent>
            </Card>

            {/* Impressum EN */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('impressumEN')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Textarea
                  rows={8}
                  value={impressumEnText}
                  onChange={(e) => setImpressumEnText(e.target.value)}
                  placeholder="Imprint text (Markdown or plain text)..."
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => saveSettingMutation.mutate({ key: 'impressum_en', value: impressumEnText })}
                  disabled={saveSettingMutation.isPending}
                >
                  {tc('save')}
                </Button>
              </CardContent>
            </Card>

            {/* Datenschutz */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('privacy')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Textarea
                  rows={8}
                  value={datenschutzText}
                  onChange={(e) => setDatenschutzText(e.target.value)}
                  placeholder="Datenschutzerklärung (Markdown oder Plain-Text)..."
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => saveSettingMutation.mutate({ key: 'datenschutz', value: datenschutzText })}
                  disabled={saveSettingMutation.isPending}
                >
                  {tc('save')}
                </Button>
              </CardContent>
            </Card>

            {/* Datenschutz EN */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('privacyEN')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Textarea
                  rows={8}
                  value={datenschutzEnText}
                  onChange={(e) => setDatenschutzEnText(e.target.value)}
                  placeholder="Privacy Policy (Markdown or plain text)..."
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => saveSettingMutation.mutate({ key: 'datenschutz_en', value: datenschutzEnText })}
                  disabled={saveSettingMutation.isPending}
                >
                  {tc('save')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log */}
          <TabsContent value="audit" className="mt-4">
            <ScrollArea className="h-[600px]">
              <div className="flex flex-col gap-2 pr-4">
                {auditLoading && <p className="text-muted-foreground">{tc('loading')}</p>}
                {auditEntries.length === 0 && !auditLoading && (
                  <p className="text-muted-foreground text-sm">{t('noAuditLog')}</p>
                )}
                {auditEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="py-2 px-4 flex items-center gap-3 flex-wrap text-sm">
                      <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
                        {entry.action}
                      </Badge>
                      <span className="text-muted-foreground flex-shrink-0">
                        {entry.admin?.displayName ?? entry.actorId?.slice(0, 8) ?? '—'}
                      </span>
                      {entry.targetType && (
                        <span className="text-xs text-muted-foreground">
                          → {entry.targetType} {entry.targetId?.slice(0, 8)}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground flex-shrink-0">
                        {new Date(entry.createdAt).toLocaleString('de-DE')}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}


