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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const API = process.env.NEXT_PUBLIC_API_URL!;

export default function AdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const t = useTranslations('admin');

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

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/users?limit=50`, { credentials: 'include' });
      return r.json();
    },
    enabled: !!user,
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
  const [datenschutzText, setDatenschutzText] = useState('');

  useEffect(() => {
    if (settings) {
      setMaintenanceMsg(settings.find((s: { key: string; value: string }) => s.key === 'maintenance_message')?.value ?? '');
      setImpressumText(settings.find((s: { key: string; value: string }) => s.key === 'impressum')?.value ?? '');
      setDatenschutzText(settings.find((s: { key: string; value: string }) => s.key === 'datenschutz')?.value ?? '');
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
    },
    onError: (e) => toast.error(e.message),
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
    onSuccess: () => toast.success('Wartungsmodus aktualisiert'),
    onError: (e) => toast.error(e.message),
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
      toast.success('Gespeichert');
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: (e) => toast.error(e.message),
  });

  const maintenanceEnabled = settings?.find((s: { key: string; value: string }) => s.key === 'maintenance_enabled')?.value === 'true';

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8 flex flex-col gap-6 max-w-5xl">
        <h1 className="text-2xl font-bold">⚙️ {t('title')}</h1>

        <Tabs defaultValue="stats">
          <TabsList>
            <TabsTrigger value="stats">{t('stats')}</TabsTrigger>
            <TabsTrigger value="users">{t('users')}</TabsTrigger>
            <TabsTrigger value="settings">{t('settings')}</TabsTrigger>
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
                      <p className="text-3xl font-bold">{s.value ?? '–'}</p>
                      <p className="text-sm text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : <p className="text-muted-foreground">Lädt...</p>}
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="mt-4">
            <div className="flex flex-col gap-2">
              {usersLoading ? <p>Lädt...</p> : (Array.isArray(users) ? users : users?.data ?? []).map((u: {
                id: string;
                displayName: string;
                profileImageUrl?: string;
                role: string;
                isBanned: boolean;
              }) => (
                <Card key={u.id}>
                  <CardContent className="flex items-center gap-3 py-3 px-4 flex-wrap">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={u.profileImageUrl} alt={u.displayName} />
                      <AvatarFallback>{u.displayName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-sm">{u.displayName}</span>
                    <Badge variant="outline">{u.role}</Badge>
                    {u.isBanned && <Badge variant="destructive">Gesperrt</Badge>}
                    <div className="ml-auto flex gap-2">
                      {u.isBanned ? (
                        <Button size="sm" variant="outline" onClick={() => banMutation.mutate({ userId: u.id, action: 'unban' })}>
                          {t('unbanUser')}
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => banMutation.mutate({ userId: u.id, action: 'ban' })}>
                          {t('banUser')}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="mt-4 flex flex-col gap-4">
            {/* Maintenance */}
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
                  <Button variant="outline" onClick={() => saveSettingMutation.mutate({ key: 'maintenance_message', value: maintenanceMsg })}>
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Impressum */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('impressum')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Textarea rows={6} value={impressumText} onChange={(e) => setImpressumText(e.target.value)} placeholder="Impressum HTML/Text..." />
                <Button variant="outline" onClick={() => saveSettingMutation.mutate({ key: 'impressum', value: impressumText })}>
                  Speichern
                </Button>
              </CardContent>
            </Card>

            {/* Datenschutz */}
            <Card>
              <CardHeader><CardTitle className="text-base">{t('privacy')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2">
                <Textarea rows={6} value={datenschutzText} onChange={(e) => setDatenschutzText(e.target.value)} placeholder="Datenschutzerklärung HTML/Text..." />
                <Button variant="outline" onClick={() => saveSettingMutation.mutate({ key: 'datenschutz', value: datenschutzText })}>
                  Speichern
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
