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
import { RefreshCw, Wifi, WifiOff, ShieldCheck, ShieldX, Eye, EyeOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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

interface InviteToken {
  id: string;
  token: string;
  role: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  usedAt?: string;
  usedBy?: string;
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

  const { data: invitesData } = useQuery<InviteToken[]>({
    queryKey: ['admin-invites'],
    queryFn: async () => {
      const r = await fetch(`${API}/admin/invites`, { credentials: 'include' });
      return r.ok ? r.json() : [];
    },
    enabled: !!user,
  });

  const [inviteNote, setInviteNote] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('STREAMER');

  const createInviteMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/invites`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: inviteNote || undefined, role: inviteRole }),
      });
      if (!r.ok) throw new Error('Fehler beim Erstellen');
      return r.json();
    },
    onSuccess: () => {
      toast.success(t('createInvite') + ' erstellt');
      setInviteNote('');
      void qc.invalidateQueries({ queryKey: ['admin-invites'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${API}/admin/invites/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) throw new Error('Fehler');
    },
    onSuccess: () => {
      toast.success(t('inviteRevoke') + ' erfolgreich');
      void qc.invalidateQueries({ queryKey: ['admin-invites'] });
    },
    onError: (e: Error) => toast.error(e.message),
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
  const [userSearch, setUserSearch] = useState('');
  const [botCreds, setBotCreds] = useState({
    clientId: '', clientSecret: '', botLogin: '', accessToken: '', refreshToken: '',
  });
  const [showBotSecrets, setShowBotSecrets] = useState(false);

  // ─── Command config ───────────────────────────────────────────────────────
  type CmdPerm = 'all' | 'mod' | 'broadcaster';
  interface CmdCfg { name: string; enabled: boolean; perm: CmdPerm; }
  type CmdSlug = 'zahl_add' | 'zahl_remove' | 'bingo' | 'buycard' | 'zahlen' | 'winners';
  const CMD_DEFAULTS: Record<CmdSlug, { label: string; defaultName: string; defaultPerm: CmdPerm }> = {
    zahl_add:    { label: 'Zahl ziehen',   defaultName: '!zahl+',         defaultPerm: 'mod' },
    zahl_remove: { label: 'Zahl entfernen',defaultName: '!zahl-',         defaultPerm: 'mod' },
    bingo:       { label: 'Bingo melden',  defaultName: 'bingo',          defaultPerm: 'all' },
    buycard:     { label: 'Karte erhalten',defaultName: '!buycard',       defaultPerm: 'all' },
    zahlen:      { label: 'Zahlen anzeigen',defaultName: '!zahlen',       defaultPerm: 'all' },
    winners:     { label: 'Gewinner anzeigen',defaultName: '!bingogewinner',defaultPerm: 'all' },
  };
  const CMD_SLUGS = Object.keys(CMD_DEFAULTS) as CmdSlug[];
  const [cmdConfigs, setCmdConfigs] = useState<Record<CmdSlug, CmdCfg>>(() =>
    Object.fromEntries(
      CMD_SLUGS.map((s) => [s, { name: CMD_DEFAULTS[s].defaultName, enabled: true, perm: CMD_DEFAULTS[s].defaultPerm }])
    ) as Record<CmdSlug, CmdCfg>
  );

  interface LegalData {
    name: string; firma: string; strasse: string; plzOrt: string; land: string;
    email: string; telefon: string; website: string; ustId: string; responsible: string;
  }
  const [legalData, setLegalData] = useState<LegalData>({
    name: '', firma: '', strasse: '', plzOrt: '', land: 'Deutschland',
    email: '', telefon: '', website: '', ustId: '', responsible: '',
  });

  useEffect(() => {
    if (settings) {
      setMaintenanceMsg(settings.find((s: { key: string }) => s.key === 'maintenance_message')?.value ?? '');
      const g = (k: string) => settings.find((s: { key: string }) => s.key === k)?.value ?? '';
      setLegalData({
        name: g('legal_name'), firma: g('legal_firma'), strasse: g('legal_strasse'),
        plzOrt: g('legal_plz_ort'), land: g('legal_land') || 'Deutschland',
        email: g('legal_email'), telefon: g('legal_telefon'),
        website: g('legal_website'), ustId: g('legal_ust_id'), responsible: g('legal_responsible'),
      });
      setBotCreds({
        clientId: g('twitch_client_id'),
        clientSecret: g('twitch_client_secret'),
        botLogin: g('bot_login'),
        accessToken: g('bot_access_token'),
        refreshToken: g('bot_refresh_token'),
      });
      // Load command configs
      setCmdConfigs(
        Object.fromEntries(
          CMD_SLUGS.map((s) => [
            s,
            {
              name:    g(`bot_cmd_${s}_name`)    || CMD_DEFAULTS[s].defaultName,
              enabled: (g(`bot_cmd_${s}_enabled`) || 'true') === 'true',
              perm:    (g(`bot_cmd_${s}_perm`)    || CMD_DEFAULTS[s].defaultPerm) as CmdPerm,
            },
          ])
        ) as Record<CmdSlug, CmdCfg>
      );
    }
  }, [settings]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const botReconnectMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`${API}/admin/bot-reconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!r.ok) throw new Error('Reconnect fehlgeschlagen');
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Reconnect gestartet');
      setTimeout(() => void refetchBotStatus(), 2000);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveBotCredsMutation = useMutation({
    mutationFn: async () => {
      const entries: [string, string][] = [
        ['twitch_client_id', botCreds.clientId],
        ['twitch_client_secret', botCreds.clientSecret],
        ['bot_login', botCreds.botLogin],
        ['bot_access_token', botCreds.accessToken],
        ['bot_refresh_token', botCreds.refreshToken],
      ].filter(([, v]) => v !== '') as [string, string][];
      await Promise.all(entries.map(([key, value]) =>
        fetch(`${API}/admin/settings/${key}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value }),
        })
      ));
      // Reconnect after saving
      const r = await fetch(`${API}/admin/bot-reconnect`, { method: 'POST', credentials: 'include' });
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Zugangsdaten gespeichert & Bot neu verbunden');
      setTimeout(() => void refetchBotStatus(), 2000);
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
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

  const saveCmdMutation = useMutation({
    mutationFn: async (slug: CmdSlug) => {
      const cfg = cmdConfigs[slug];
      await Promise.all([
        fetch(`${API}/admin/settings/bot_cmd_${slug}_name`,    { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: cfg.name }) }),
        fetch(`${API}/admin/settings/bot_cmd_${slug}_enabled`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: String(cfg.enabled) }) }),
        fetch(`${API}/admin/settings/bot_cmd_${slug}_perm`,    { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: cfg.perm }) }),
      ]);
    },
    onSuccess: () => { toast.success('Befehl gespeichert'); void qc.invalidateQueries({ queryKey: ['admin-settings'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveLegalFields = async (d: typeof legalData) => {
    const entries: [string, string][] = [
      ['legal_name', d.name], ['legal_firma', d.firma], ['legal_strasse', d.strasse],
      ['legal_plz_ort', d.plzOrt], ['legal_land', d.land], ['legal_email', d.email],
      ['legal_telefon', d.telefon], ['legal_website', d.website],
      ['legal_ust_id', d.ustId], ['legal_responsible', d.responsible],
    ];
    await Promise.all(entries.map(([key, value]) =>
      fetch(`${API}/admin/settings/${key}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      })
    ));
  };

  const buildImpressumDE = (d: typeof legalData) => {
    const lines = ['## Impressum\n', '### Angaben gemäß § 5 TMG\n'];
    if (d.firma) lines.push(`**${d.firma}**  `);
    if (d.name) lines.push(`${d.name}  `);
    if (d.strasse) lines.push(`${d.strasse}  `);
    if (d.plzOrt) lines.push(`${d.plzOrt}  `);
    if (d.land) lines.push(`${d.land}\n`);
    lines.push('### Kontakt\n');
    if (d.email) lines.push(`E-Mail: ${d.email}  `);
    if (d.telefon) lines.push(`Telefon: ${d.telefon}  `);
    if (d.website) lines.push(`Website: ${d.website}\n`);
    if (d.ustId) lines.push(`### Umsatzsteuer-ID\n\nUmsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${d.ustId}\n`);
    if (d.responsible) lines.push(`### Inhaltlich Verantwortlicher\n\nVerantwortlicher gem. § 18 Abs. 2 MStV: ${d.responsible}\n`);
    return lines.join('\n');
  };

  const buildImpressumEN = (d: typeof legalData) => {
    const lines = ['## Imprint\n', '### Information pursuant to § 5 TMG\n'];
    if (d.firma) lines.push(`**${d.firma}**  `);
    if (d.name) lines.push(`${d.name}  `);
    if (d.strasse) lines.push(`${d.strasse}  `);
    if (d.plzOrt) lines.push(`${d.plzOrt}  `);
    if (d.land) lines.push(`${d.land}\n`);
    lines.push('### Contact\n');
    if (d.email) lines.push(`Email: ${d.email}  `);
    if (d.telefon) lines.push(`Phone: ${d.telefon}  `);
    if (d.website) lines.push(`Website: ${d.website}\n`);
    if (d.ustId) lines.push(`### VAT ID\n\nVAT identification number pursuant to § 27a German VAT Act: ${d.ustId}\n`);
    if (d.responsible) lines.push(`### Person responsible for content\n\nResponsible pursuant to § 18 Para. 2 MStV: ${d.responsible}\n`);
    return lines.join('\n');
  };

  const buildDatenschutzDE = (d: typeof legalData) => {
    const op = [d.firma, d.name].filter(Boolean).join(' / ');
    const addr = [d.strasse, d.plzOrt, d.land].filter(Boolean).join(', ');
    return `## Datenschutzerklärung

### 1. Verantwortlicher

Verantwortlicher im Sinne der DSGVO:

**${op}**  
${addr}  
E-Mail: ${d.email}${d.telefon ? `  \nTelefon: ${d.telefon}` : ''}

### 2. Erhobene Daten

Bei der Nutzung dieser Website werden folgende Daten verarbeitet:

- **Twitch-OAuth-Daten**: Benutzername, Profilbild (für die Anmeldung per Twitch)
- **Bingo-Spielstände**: Zugewiesene Karten und Spielergebnisse
- **Technische Daten**: IP-Adresse, Browser-Typ, Datum und Uhrzeit des Zugriffs (Server-Logs)

### 3. Rechtsgrundlage

Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) und Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse).

### 4. Cookies und Sessions

Diese Website verwendet Session-Cookies zur Authentifizierung. Diese Cookies sind technisch notwendig und werden nach Sitzungsende gelöscht.

### 5. Drittdienste

Zur Anmeldung wird **Twitch** (Twitch Interactive, Inc., San Francisco, CA, USA) als OAuth-Anbieter genutzt. Es gelten die [Datenschutzrichtlinien von Twitch](https://www.twitch.tv/p/de-de/legal/privacy-policy/).

### 6. Speicherdauer

Personenbezogene Daten werden gelöscht, sobald sie für den Zweck, für den sie erhoben wurden, nicht mehr benötigt werden. Account-Daten werden auf Anfrage gelöscht.

### 7. Deine Rechte

Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit. Wende dich dafür an: ${d.email}

### 8. Beschwerderecht

Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
`;
  };

  const buildDatenschutzEN = (d: typeof legalData) => {
    const op = [d.firma, d.name].filter(Boolean).join(' / ');
    const addr = [d.strasse, d.plzOrt, d.land].filter(Boolean).join(', ');
    return `## Privacy Policy

### 1. Controller

Controller within the meaning of the GDPR:

**${op}**  
${addr}  
Email: ${d.email}${d.telefon ? `  \nPhone: ${d.telefon}` : ''}

### 2. Data Collected

The following data is processed when using this website:

- **Twitch OAuth data**: Username, profile picture (for Twitch login)
- **Bingo game data**: Assigned cards and game results
- **Technical data**: IP address, browser type, date and time of access (server logs)

### 3. Legal Basis

Processing is based on Art. 6(1)(b) GDPR (contractual performance) and Art. 6(1)(f) GDPR (legitimate interest).

### 4. Cookies and Sessions

This website uses session cookies for authentication. These cookies are technically necessary and are deleted after the session ends.

### 5. Third-Party Services

**Twitch** (Twitch Interactive, Inc., San Francisco, CA, USA) is used as an OAuth provider for login. The [Twitch Privacy Policy](https://www.twitch.tv/p/legal/privacy-policy/) applies.

### 6. Storage Duration

Personal data is deleted when it is no longer needed for the purpose for which it was collected. Account data is deleted upon request.

### 7. Your Rights

You have the right to access, rectification, erasure, restriction of processing, and data portability. Contact: ${d.email}

### 8. Right to Lodge a Complaint

You have the right to lodge a complaint with a data protection supervisory authority.
`;
  };

  const generateImpressumMutation = useMutation({
    mutationFn: async () => {
      await saveLegalFields(legalData);
      await Promise.all([
        fetch(`${API}/admin/settings/impressum`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: buildImpressumDE(legalData) }) }),
        fetch(`${API}/admin/settings/impressum_en`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: buildImpressumEN(legalData) }) }),
      ]);
    },
    onSuccess: () => { toast.success('Impressum generiert & gespeichert!'); void qc.invalidateQueries({ queryKey: ['admin-settings'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateDatenschutzMutation = useMutation({
    mutationFn: async () => {
      await saveLegalFields(legalData);
      await Promise.all([
        fetch(`${API}/admin/settings/datenschutz`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: buildDatenschutzDE(legalData) }) }),
        fetch(`${API}/admin/settings/datenschutz_en`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: buildDatenschutzEN(legalData) }) }),
      ]);
    },
    onSuccess: () => { toast.success('Datenschutzerklärung generiert & gespeichert!'); void qc.invalidateQueries({ queryKey: ['admin-settings'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveFieldsMutation = useMutation({
    mutationFn: async () => { await saveLegalFields(legalData); },
    onSuccess: () => { toast.success('Felder gespeichert!'); void qc.invalidateQueries({ queryKey: ['admin-settings'] }); },
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
            <TabsTrigger value="invites">🔗 {t('invites')}</TabsTrigger>
            <TabsTrigger value="impressum">📄 {t('impressumTab')}</TabsTrigger>
            <TabsTrigger value="datenschutz">🔒 {t('datenschutzTab')}</TabsTrigger>
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
                <div className="flex gap-2 flex-wrap">
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
                  <Button
                    variant={botStatus?.connected ? 'outline' : 'default'}
                    size="sm"
                    className="w-fit"
                    onClick={() => botReconnectMutation.mutate()}
                    disabled={botReconnectMutation.isPending || botStatus?.connected}
                  >
                    <Wifi className="w-3 h-3 mr-2" />
                    {botReconnectMutation.isPending ? tb('reconnecting') : tb('reconnect')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bot Credentials */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  🔑 {tb('credentials')}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setShowBotSecrets((v) => !v)}>
                    {showBotSecrets ? <><EyeOff className="w-3 h-3 mr-1" />{tb('hideSecrets')}</> : <><Eye className="w-3 h-3 mr-1" />{tb('showSecrets')}</>}
                  </Button>
                </CardTitle>
                <CardDescription>{tb('credentialsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">

                {/* Section 1: Twitch App */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
                      1 · Twitch App —{' '}
                      <a
                        href="https://dev.twitch.tv/console"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline normal-case font-normal"
                      >
                        dev.twitch.tv/console
                      </a>
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Einmalig aus deiner registrierten Twitch-Anwendung. Diese Zugangsdaten laufen <strong>nicht</strong> ab.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Client ID *</Label>
                      <Input
                        value={botCreds.clientId}
                        onChange={(e) => setBotCreds((c) => ({ ...c, clientId: e.target.value }))}
                        placeholder="gpvv37qzyach..."
                        type={showBotSecrets ? 'text' : 'password'}
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Client Secret *</Label>
                      <Input
                        value={botCreds.clientSecret}
                        onChange={(e) => setBotCreds((c) => ({ ...c, clientSecret: e.target.value }))}
                        placeholder="vwrdks19wbke..."
                        type={showBotSecrets ? 'text' : 'password'}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Bot Account Tokens */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2">
                      2 · Bot-Account Token —{' '}
                      <a
                        href="https://twitchtokengenerator.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline normal-case font-normal"
                      >
                        twitchtokengenerator.com
                      </a>
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 flex flex-col gap-1">
                    <strong>⚠️ Wichtig beim Token generieren:</strong>
                    <ol className="list-decimal list-inside space-y-0.5 mt-0.5">
                      <li>Auf twitchtokengenerator.com <strong>„Custom Scope Token"</strong> wählen</li>
                      <li>Oben rechts <strong>„Use my own client credentials"</strong> aktivieren</li>
                      <li>Deine Client ID + Secret von oben eintragen</li>
                      <li>Scopes: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">chat:read</code> und <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">chat:edit</code> auswählen</li>
                      <li>Als <strong>Bot-Account</strong> (nicht als Streamer) einloggen</li>
                    </ol>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Bot Twitch-Benutzername *</Label>
                      <Input
                        value={botCreds.botLogin}
                        onChange={(e) => setBotCreds((c) => ({ ...c, botLogin: e.target.value }))}
                        placeholder="mein_bot_account"
                        autoComplete="off"
                      />
                      <span className="text-xs text-muted-foreground">Twitch-Login des Bot-Accounts (Kleinbuchstaben)</span>
                    </div>
                    <div className="hidden sm:block" />
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <Label className="text-xs">Access Token *</Label>
                      <Input
                        value={botCreds.accessToken}
                        onChange={(e) => setBotCreds((c) => ({ ...c, accessToken: e.target.value }))}
                        placeholder="ACCESS TOKEN aus twitchtokengenerator.com"
                        type={showBotSecrets ? 'text' : 'password'}
                        autoComplete="off"
                      />
                      <span className="text-xs text-muted-foreground">Beginnt typischerweise nicht mit „oauth:" — den Token-Wert direkt kopieren.</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <Label className="text-xs">Refresh Token *</Label>
                      <Input
                        value={botCreds.refreshToken}
                        onChange={(e) => setBotCreds((c) => ({ ...c, refreshToken: e.target.value }))}
                        placeholder="REFRESH TOKEN aus twitchtokengenerator.com"
                        type={showBotSecrets ? 'text' : 'password'}
                        autoComplete="off"
                      />
                      <span className="text-xs text-muted-foreground">Ermöglicht automatische Erneuerung — ohne Refresh Token muss nach ~4 h manuell neu verbunden werden.</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => saveBotCredsMutation.mutate()}
                  disabled={saveBotCredsMutation.isPending || !botCreds.clientId || !botCreds.clientSecret || !botCreds.botLogin || !botCreds.accessToken}
                  className="w-fit"
                >
                  <Wifi className="w-3 h-3 mr-2" />
                  {saveBotCredsMutation.isPending ? tb('reconnecting') : tb('saveAndReconnect')}
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
                <div className="flex flex-col gap-2">
                  {/* Header row */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_1fr_180px_120px_auto] gap-2 px-2 text-xs font-semibold text-muted-foreground">
                    <span>Funktion</span>
                    <span>Befehlsname</span>
                    <span>Berechtigung</span>
                    <span>Aktiv</span>
                    <span />
                  </div>
                  {CMD_SLUGS.map((slug) => {
                    const cfg = cmdConfigs[slug];
                    const def = CMD_DEFAULTS[slug];
                    return (
                      <div key={slug} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_180px_120px_auto] gap-2 items-center border rounded-lg p-3 sm:p-2">
                        <div className="text-sm font-medium">{def.label}</div>
                        <Input
                          value={cfg.name}
                          onChange={(e) => setCmdConfigs((prev) => ({ ...prev, [slug]: { ...prev[slug], name: e.target.value } }))}
                          className="h-8 text-sm font-mono"
                          placeholder={def.defaultName}
                        />
                        <Select
                          value={cfg.perm}
                          onValueChange={(v) => setCmdConfigs((prev) => ({ ...prev, [slug]: { ...prev[slug], perm: v as CmdPerm } }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Alle Zuschauer</SelectItem>
                            <SelectItem value="mod">Mod &amp; Broadcaster</SelectItem>
                            <SelectItem value="broadcaster">Nur Broadcaster</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={cfg.enabled}
                            onCheckedChange={(v) => setCmdConfigs((prev) => ({ ...prev, [slug]: { ...prev[slug], enabled: v } }))}
                          />
                          <span className="text-xs text-muted-foreground">{cfg.enabled ? 'An' : 'Aus'}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => saveCmdMutation.mutate(slug)}
                          disabled={saveCmdMutation.isPending}
                        >
                          {tc('save')}
                        </Button>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground mt-2">
                    Für Zahlen-Befehle: Befehlsname ist das Präfix vor der Zahl, z.B. <code className="font-mono">!zahl+</code> → Aufruf: <code className="font-mono">!zahl+42</code>
                  </p>
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
                    {tc('save')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Version Info */}
            <Card>
              <CardHeader><CardTitle className="text-base">ℹ️ {t('versionInfo')}</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="font-mono text-sm">v1.1.0</Badge>
                  <span className="text-muted-foreground">2026-06-01</span>
                </div>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                  <li>Channel Points Rewards System (Auto-Aktivierung bei Spielstart)</li>
                  <li>Einladungslinks für neue Streamer/Moderatoren</li>
                  <li>Moderator-Auto-Erkennung via Twitch OAuth</li>
                  <li>Karten-Markierungen werden serverseitig gespeichert</li>
                  <li>Moderator-Dashboard: Name inline neben Avatar</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Impressum Tab */}
          <TabsContent value="impressum" className="mt-4 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('legalFields')}</CardTitle>
                <CardDescription>{t('legalFieldsDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalName')} *</Label>
                    <Input value={legalData.name} onChange={(e) => setLegalData((d) => ({ ...d, name: e.target.value }))} placeholder="Max Mustermann" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalFirma')}</Label>
                    <Input value={legalData.firma} onChange={(e) => setLegalData((d) => ({ ...d, firma: e.target.value }))} placeholder="Muster GmbH" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalStrasse')} *</Label>
                    <Input value={legalData.strasse} onChange={(e) => setLegalData((d) => ({ ...d, strasse: e.target.value }))} placeholder="Musterstraße 1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalPlzOrt')} *</Label>
                    <Input value={legalData.plzOrt} onChange={(e) => setLegalData((d) => ({ ...d, plzOrt: e.target.value }))} placeholder="12345 Musterstadt" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalLand')} *</Label>
                    <Input value={legalData.land} onChange={(e) => setLegalData((d) => ({ ...d, land: e.target.value }))} placeholder="Deutschland" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalEmail')} *</Label>
                    <Input type="email" value={legalData.email} onChange={(e) => setLegalData((d) => ({ ...d, email: e.target.value }))} placeholder="kontakt@example.de" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalTelefon')}</Label>
                    <Input value={legalData.telefon} onChange={(e) => setLegalData((d) => ({ ...d, telefon: e.target.value }))} placeholder="+49 123 456789" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalWebsite')}</Label>
                    <Input value={legalData.website} onChange={(e) => setLegalData((d) => ({ ...d, website: e.target.value }))} placeholder="https://example.de" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalUstId')}</Label>
                    <Input value={legalData.ustId} onChange={(e) => setLegalData((d) => ({ ...d, ustId: e.target.value }))} placeholder="DE123456789" />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <Label className="text-xs">{t('legalResponsible')}</Label>
                    <Input value={legalData.responsible} onChange={(e) => setLegalData((d) => ({ ...d, responsible: e.target.value }))} placeholder="Max Mustermann, Musterstraße 1, 12345 Musterstadt" />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => saveFieldsMutation.mutate()}
                    disabled={saveFieldsMutation.isPending}
                    className="w-fit"
                  >
                    {saveFieldsMutation.isPending ? t('saving') : t('saveFields')}
                  </Button>
                  <Button
                    onClick={() => generateImpressumMutation.mutate()}
                    disabled={generateImpressumMutation.isPending}
                    className="w-fit"
                  >
                    {generateImpressumMutation.isPending ? t('generating') : t('generateImpressum')}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground text-sm">{t('previewDE')}</CardTitle>
                <CardDescription className="text-xs">Vorschau des generierten Impressums — so erscheint es später auf der Seite.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none border rounded p-4 bg-muted/30">
                  <ReactMarkdown>{buildImpressumDE(legalData)}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground text-sm">{t('previewEN')}</CardTitle>
                <CardDescription className="text-xs">Preview of the generated English imprint.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none border rounded p-4 bg-muted/30">
                  <ReactMarkdown>{buildImpressumEN(legalData)}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Datenschutz Tab */}
          <TabsContent value="datenschutz" className="mt-4 flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('legalFields')}</CardTitle>
                <CardDescription>{t('legalFieldsDatenschutzDesc')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalName')} *</Label>
                    <Input value={legalData.name} onChange={(e) => setLegalData((d) => ({ ...d, name: e.target.value }))} placeholder="Max Mustermann" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalFirma')}</Label>
                    <Input value={legalData.firma} onChange={(e) => setLegalData((d) => ({ ...d, firma: e.target.value }))} placeholder="Muster GmbH" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalStrasse')} *</Label>
                    <Input value={legalData.strasse} onChange={(e) => setLegalData((d) => ({ ...d, strasse: e.target.value }))} placeholder="Musterstraße 1" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalPlzOrt')} *</Label>
                    <Input value={legalData.plzOrt} onChange={(e) => setLegalData((d) => ({ ...d, plzOrt: e.target.value }))} placeholder="12345 Musterstadt" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalLand')} *</Label>
                    <Input value={legalData.land} onChange={(e) => setLegalData((d) => ({ ...d, land: e.target.value }))} placeholder="Deutschland" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalEmail')} *</Label>
                    <Input type="email" value={legalData.email} onChange={(e) => setLegalData((d) => ({ ...d, email: e.target.value }))} placeholder="kontakt@example.de" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalTelefon')}</Label>
                    <Input value={legalData.telefon} onChange={(e) => setLegalData((d) => ({ ...d, telefon: e.target.value }))} placeholder="+49 123 456789" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">{t('legalWebsite')} *</Label>
                    <Input value={legalData.website} onChange={(e) => setLegalData((d) => ({ ...d, website: e.target.value }))} placeholder="https://example.de" />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => saveFieldsMutation.mutate()}
                    disabled={saveFieldsMutation.isPending}
                    className="w-fit"
                  >
                    {saveFieldsMutation.isPending ? t('saving') : t('saveFields')}
                  </Button>
                  <Button
                    onClick={() => generateDatenschutzMutation.mutate()}
                    disabled={generateDatenschutzMutation.isPending}
                    className="w-fit"
                  >
                    {generateDatenschutzMutation.isPending ? t('generating') : t('generateDatenschutz')}
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground text-sm">{t('previewDE')}</CardTitle>
                <CardDescription className="text-xs">Vorschau der generierten Datenschutzerklärung.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none border rounded p-4 bg-muted/30 max-h-96 overflow-y-auto">
                  <ReactMarkdown>{buildDatenschutzDE(legalData)}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground text-sm">{t('previewEN')}</CardTitle>
                <CardDescription className="text-xs">Preview of the generated English privacy policy.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none border rounded p-4 bg-muted/30 max-h-96 overflow-y-auto">
                  <ReactMarkdown>{buildDatenschutzEN(legalData)}</ReactMarkdown>
                </div>
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

          {/* Invites */}
          <TabsContent value="invites" className="mt-4">
            <div className="flex flex-col gap-4">
              {/* Create invite form */}
              <Card>
                <CardHeader><CardTitle className="text-base">{t('createInvite')}</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <Label>{t('inviteNote')}</Label>
                    <Input
                      value={inviteNote}
                      onChange={(e) => setInviteNote(e.target.value)}
                      placeholder="z.B. Für MeinKumpel_TV"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>{t('inviteRole')}</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STREAMER">STREAMER</SelectItem>
                        <SelectItem value="MODERATOR">MODERATOR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => createInviteMutation.mutate()}
                    disabled={createInviteMutation.isPending}
                    className="self-start"
                  >
                    {t('inviteCreate')}
                  </Button>
                </CardContent>
              </Card>

              {/* Invite list */}
              {(invitesData ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noInvites')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(invitesData ?? []).map((inv) => {
                    const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inv.token}`;
                    return (
                      <Card key={inv.id}>
                        <CardContent className="py-3 px-4 flex flex-col gap-2 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={inv.usedAt ? 'secondary' : 'default'} className="flex-shrink-0">
                              {inv.usedAt ? t('inviteUsed') : t('inviteUnused')}
                            </Badge>
                            <Badge variant="outline" className="flex-shrink-0">{inv.role}</Badge>
                            {inv.note && <span className="text-muted-foreground">{inv.note}</span>}
                            <span className="ml-auto text-xs text-muted-foreground">
                              {t('inviteCreatedAt')}: {new Date(inv.createdAt).toLocaleString('de-DE')}
                            </span>
                          </div>
                          {!inv.usedAt && (
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-muted rounded px-2 py-1 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                                {link}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  void navigator.clipboard.writeText(link).then(() =>
                                    toast.success(t('inviteLinkCopied'))
                                  );
                                }}
                              >
                                Kopieren
                              </Button>
                            </div>
                          )}
                          {inv.usedAt && (
                            <p className="text-xs text-muted-foreground">
                              {t('inviteUsedAt')}: {new Date(inv.usedAt).toLocaleString('de-DE')}
                            </p>
                          )}
                          {!inv.usedAt && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="self-start"
                              onClick={() => revokeInviteMutation.mutate(inv.id)}
                              disabled={revokeInviteMutation.isPending}
                            >
                              {t('inviteRevoke')}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}


